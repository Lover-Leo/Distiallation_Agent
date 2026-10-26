"""Local, text-only, scoped sample. Does not send or modify WeChat messages."""
import contextlib
import hashlib
import importlib.util
import io
import gc
import json
import os
from pathlib import Path
import site
import shutil
import sys
from datetime import datetime, timezone
from wechat_scope import restricted_source

ROOT = Path(__file__).resolve().parents[1]
TOOL = ROOT / 'tools' / 'wechat-export'


def main():
    scope = json.loads((ROOT / 'data/private/export-scope.json').read_text(encoding='utf-8'))
    source = (TOOL / 'exporter_core.py').read_text(encoding='utf-8-sig')
    patched = restricted_source(source, scope)
    prefix = 'wechat-export-' if scope['sample_limit'] is None else 'wechat-sample-'
    run = ROOT / 'outputs' / (prefix + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    run.mkdir(parents=True, exist_ok=False)
    # Confine dependency cache/log side effects to this private run directory.
    os.chdir(run)
    os.environ['WECHATAUTO_KEYS_DIR'] = str(run / 'sensitive' / 'keys')
    site.addsitedir(str(TOOL / 'deps'))
    for subdir in ['win32', 'win32/lib', 'Pythonwin', 'pywin32_system32']:
        sys.path.insert(0, str(TOOL / 'deps' / subdir))
    dll_handle = os.add_dll_directory(str(TOOL / 'deps' / 'pywin32_system32'))
    capture = io.StringIO()
    report = {'status': 'started', 'source_sha256': hashlib.sha256(source.encode()).hexdigest(),
              'scope': scope, 'cloud_requests': False}
    try:
        with contextlib.redirect_stdout(capture), contextlib.redirect_stderr(capture):
            spec = importlib.util.spec_from_loader('scoped_exporter', loader=None)
            mod = importlib.util.module_from_spec(spec)
            mod.__file__ = str(TOOL / 'exporter_core.py')
            exec(compile(patched, mod.__file__, 'exec'), mod.__dict__)
            upstream_db = mod.WeChatDB
            account = Path(scope['account_dir']).name
            class PinnedAccountDB(upstream_db):
                def _pick_account(self):
                    return account
                def _try_other_accounts(self):
                    return False
                def _select_account_by_keys(self, candidates):
                    return False
                def _collect_db_files(self):
                    files = super()._collect_db_files()
                    return [(rel, path, size) for rel, path, size in files
                            if Path(path).name == 'contact.db'
                            or (Path(path).name.startswith('message_')
                                and Path(path).name[8:-3].isdigit())]
            mod.WeChatDB = PinnedAccountDB
            # No cleanup of other tools' pre-existing caches.
            mod.SENSITIVE_TEMP_ROOT_NAME = str(run / 'sensitive')
            mod.clear_current_sensitive_cache = lambda: {'removed': []}
            result = mod.export_chat(scope['contact'], out_root=str(run / 'export'),
                                     db_dir=scope['data_root'])
        report.update(status='exported', result=result)
        print(json.dumps({'status': 'exported', 'messages': result['message_count'], 'report': str(run / 'report.json')}))
    except Exception as exc:
        report.update(status='failed', error_type=type(exc).__name__, error=str(exc))
        print(json.dumps({'status': 'failed', 'error_type': type(exc).__name__, 'report': str(run / 'report.json')}))
        return 1
    finally:
        # Library output can contain keys; deliberately do not persist it.
        capture.close()
        gc.collect()
        cache = (run / 'sensitive').resolve()
        if not cache.is_relative_to(run.resolve()):
            raise RuntimeError('Unsafe cache location')
        try:
            if cache.exists():
                shutil.rmtree(cache)
            report['post_export_cache_cleanup'] = True
        except OSError:
            report['post_export_cache_cleanup'] = False
        (run / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        dll_handle.close()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
