import ast
import hashlib
from pathlib import Path
import sqlite3
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from wechat_scope import restricted_source


class ScopeTests(unittest.TestCase):
    def test_scoped_query_and_identity(self):
        root = Path(__file__).resolve().parents[1]
        source = (root / 'tools/wechat-export/exporter_core.py').read_text(encoding='utf-8-sig')
        scope = {'start': '2025-10-26T00:00:00+08:00', 'end_exclusive': '2026-10-27T00:00:00+08:00', 'sample_limit': 2}
        tree = ast.parse(restricted_source(source, scope))
        names = {'load_rows', 'find_contact'}
        module = ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names], type_ignores=[])
        env = {'WeChatDB': object, 'hashlib': hashlib, 'table_columns': lambda c,t: {r[1] for r in c.execute(f'PRAGMA table_info({t})')}, '_sender_map': lambda c: ({1: 'self'}, 'resolved'), '_sender_id': lambda x:x, '_identity_username': lambda x:x, '_normalize_timestamp': lambda x:x//1000 if x>10000000000 else x}
        exec(compile(module, '<scoped-test>', 'exec'), env)
        class DB:
            def _message_dbs(self): return ['shard1', 'shard2']
            def _open(self, rel):
                c = sqlite3.connect(':memory:')
                t = 'Msg_' + hashlib.md5(b'contact').hexdigest()
                c.execute(f'CREATE TABLE {t}(local_id INTEGER, local_type INTEGER, real_sender_id INTEGER, create_time INTEGER, message_content TEXT)')
                times = [1761407999, 1761408000, 1793030400, 1793030399000]
                for i, ts in enumerate(times):
                    c.execute(f'INSERT INTO {t} VALUES(?,1,1,?,?)', (i,ts,'fictional'))
                c.execute(f'INSERT INTO {t} VALUES(9,3,1,1761408100,"image")')
                return c
            def search_contact(self, keyword): return [{'remark': keyword, 'username': 'contact'}]
        db = DB()
        rows = env['load_rows'](db, 'contact')
        self.assertEqual(len(rows), 2)
        self.assertTrue(all(r['create_time'] == 1793030399000 for r in rows))
        scope['sample_limit'] = None
        tree = ast.parse(restricted_source(source, scope))
        module = ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names], type_ignores=[])
        exec(compile(module, '<full-export-test>', 'exec'), env)
        all_rows = env['load_rows'](db, 'contact')
        self.assertEqual(len(all_rows), 4)
        self.assertEqual({r['create_time'] for r in all_rows}, {1761408000, 1793030399000})
        self.assertEqual(env['find_contact'](db,'name')['username'],'contact')
        db.search_contact = lambda k: [{'remark': k, 'username':'a'}, {'remark':k,'username':'b'}]
        with self.assertRaises(ValueError): env['find_contact'](db,'name')
        db.search_contact = lambda k: [{'remark': 'other', 'username':'a'}]
        with self.assertRaises(ValueError): env['find_contact'](db,'name')


if __name__ == '__main__': unittest.main()
