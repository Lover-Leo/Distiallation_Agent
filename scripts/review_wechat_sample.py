"""Validate exported sample and create a local review page; never print chat text."""
from datetime import datetime
import hashlib
import html
import json
from pathlib import Path
import sys


def review(report_path):
    report_path = Path(report_path).resolve()
    run = report_path.parent
    report = json.loads(report_path.read_text(encoding='utf-8'))
    if report['status'] != 'exported':
        raise ValueError('Export did not succeed')
    data_path = Path(report['result']['json']).resolve()
    if not data_path.is_relative_to(run):
        raise ValueError('Export outside run directory')
    data = json.loads(data_path.read_text(encoding='utf-8-sig'))
    scope = report['scope']
    start = datetime.fromisoformat(scope['start'])
    end = datetime.fromisoformat(scope['end_exclusive'])
    normalized, seen = [], set()
    for m in data['messages']:
        timestamp = datetime.fromisoformat(m['time']).replace(tzinfo=start.tzinfo)
        if not start <= timestamp < end or m['sender_status'] != 'resolved' or type(m['is_self']) is not bool:
            raise ValueError('Date or sender validation failed')
        if int(m['type_code']) & 65535 != 1:
            raise ValueError('Unexpected non-text message')
        identity = f"{m['source_db']}:{m['local_id']}"
        if identity in seen:
            raise ValueError('Duplicate message ID')
        seen.add(identity)
        normalized.append({'platform': 'wechat', 'conversation_id': 'contact-A',
                           'message_id': identity, 'sender_id': 'self' if m['is_self'] else 'contact-A',
                           'timestamp': timestamp.isoformat(), 'message_type': 'text', 'text': m['content'],
                           'reply_to': None, 'source_file': str(data_path.relative_to(run)),
                           'server_id': str(m['server_id']) if m['server_id'] is not None else None})
    if scope['sample_limit'] is not None and len(normalized) > scope['sample_limit']:
        raise ValueError('Sample limit exceeded')
    normalized.sort(key=lambda m: (m['timestamp'], m['message_id']))
    page = ['<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>微信样本核对</title>',
            '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'">',
            '<style>body{font:16px system-ui;max-width:850px;margin:35px auto;padding:20px}article{white-space:pre-wrap;padding:15px;background:#f2f4f8;margin:10px 0;border-radius:10px}.self{background:#e3f4eb}small{color:#555}</style>',
            '<h1>真实微信样本 · 仅本地核对</h1><p>请核对“我／对方”、顺序与文字是否对应微信原记录。未上传云端。</p>']
    review_rows = normalized
    if len(normalized) > 500:
        review_rows = [normalized[i * (len(normalized) - 1) // 499] for i in range(500)]
        page.append(f'<p>共 {len(normalized)} 条记录，本页按时间均匀抽取 500 条供核对；完整记录见同目录 normalized.json。</p>')
    for m in review_rows:
        who = '我' if m['sender_id'] == 'self' else '对方'
        page.append(f'<article class="{m["sender_id"]}"><small>{html.escape(m["timestamp"])} · {who}</small><br>{html.escape(m["text"])}</article>')
    page.append('</html>')
    (run / 'review.html').write_text('\n'.join(page), encoding='utf-8')
    (run / 'normalized.json').write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding='utf-8')
    monthly = {}
    for m in normalized:
        month = m['timestamp'][:7]
        monthly[month] = monthly.get(month, 0) + 1
    summary = {'messages': len(normalized), 'self': sum(m['sender_id']=='self' for m in normalized),
               'other': sum(m['sender_id']!='self' for m in normalized),
               'first': normalized[0]['timestamp'] if normalized else None,
               'last': normalized[-1]['timestamp'] if normalized else None,
               'export_sha256': hashlib.sha256(data_path.read_bytes()).hexdigest(),
               'requested_start': scope['start'], 'requested_end_exclusive': scope['end_exclusive'],
               'monthly_counts': monthly, 'cache_removed': not (run / 'sensitive').exists(), 'human_review': 'pending'}
    (run / 'validation.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
    print(json.dumps(summary))


if __name__ == '__main__': review(sys.argv[1])
