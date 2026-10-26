"""Restrict upstream exporter before any message queries are executed."""
import ast
from datetime import datetime


def restricted_source(source, scope):
    start = int(datetime.fromisoformat(scope['start']).timestamp())
    end = int(datetime.fromisoformat(scope['end_exclusive']).timestamp())
    limit = scope['sample_limit']
    if start >= end or (limit is not None and (type(limit) is not int or not 1 <= limit <= 1000)):
        raise ValueError('Invalid export interval or sample size')
    old_contact = 'return exact[0] if exact else results[0]'
    new_contact = '''if len(exact) != 1:
        raise ValueError("Contact must match exactly once; no fuzzy fallback")
    if exact[0]["username"].endswith("@chatroom"):
        raise ValueError("Private chats only")
    return exact[0]'''
    old_query = '''"SELECT " + ", ".join(select_cols) + f" FROM {table}"
            )'''
    new_query = f'''"SELECT " + ", ".join(select_cols) + f" FROM {{table}}"
                " WHERE ((create_time >= ? AND create_time < ?)"
                " OR (create_time >= ? AND create_time < ?))"
                " AND (local_type & 65535) = 1"
                " ORDER BY CASE WHEN create_time > 10000000000"
                " THEN create_time / 1000 ELSE create_time END DESC, local_id DESC LIMIT ?",
                ({start}, {end}, {start * 1000}, {end * 1000}, {limit if limit is not None else -1})
            )'''
    for old, new in [(old_contact, new_contact), (old_query, new_query)]:
        if source.count(old) != 1:
            raise ValueError('Upstream code changed; refusing unscoped export')
        source = source.replace(old, new)
    tree = ast.parse(source)
    function = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'load_rows')
    ret = function.body[-1]
    if not isinstance(ret, ast.Return):
        raise ValueError('Upstream return changed')
    lines = source.splitlines(keepends=True)
    lines[ret.lineno - 1:ret.end_lineno] = [
        '    rows.sort(key=lambda r: (_normalize_timestamp(r["create_time"]), r["local_id"]))\n',
        f'    return rows[-{limit}:]\n' if limit is not None else '    return rows\n',
    ]
    return ''.join(lines)
