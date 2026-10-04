"""Engine-backed session browsing and management. Engines own sessions.

Reads come from each engine's own store, opened read-only. Every mutation
goes through the engine's own CLI, never direct SQL writes. The village
keeps no session store of its own; runs/*.json only records runs.
"""
import json
import sqlite3
import subprocess
from pathlib import Path

import config as village_config
import runtime

TITLE_LIMIT = 200


def _hermes_db():
    return village_config.hermes_home() / 'state.db'


def _ro(db_path, query, params=(), timeout=5):
    """Read-only query against an engine database. Raises on failure."""
    with sqlite3.connect(f'file:{db_path}?mode=ro', uri=True, timeout=timeout) as con:
        con.row_factory = sqlite3.Row
        return [dict(row) for row in con.execute(query, params)]


def _run_cli(engine, args, timeout=25):
    """Run an engine CLI management command. Returns stdout, raises on error."""
    proc = subprocess.run(runtime.engine_command(engine) + args,
                          capture_output=True, text=True, timeout=timeout)
    if proc.returncode:
        raise ValueError(_cli_error(proc))
    return proc.stdout.strip()


def _cli_error(proc):
    text = (proc.stderr.strip() or proc.stdout.strip() or f'exit {proc.returncode}')
    if 'already in use by session' in text:
        return 'That title is already used by another session. Pick a different title.'
    return runtime.redact(text)[:500]


def _rel_time(ts):
    if not ts:
        return '—'
    import time
    delta = time.time() - ts
    if delta < 3600:
        return f'{max(1, int(delta // 60))}m ago'
    if delta < 86400:
        return f'{int(delta // 3600)}h ago'
    if delta < 86400 * 30:
        return f'{int(delta // 86400)}d ago'
    return time.strftime('%Y-%m-%d', time.localtime(ts))


def list_opencode(repo):
    """Engine-filtered, repo-scoped OpenCode sessions from its own store."""
    try:
        resolved = village_config.resolve_engine('opencode')
        if not resolved['command']:
            return [], 'OpenCode CLI not found. ' + village_config.INSTALL_HINTS['opencode']
        proc = subprocess.run([resolved['command'], 'session', 'list', '--format', 'json', '-n', '200'],
                              capture_output=True, text=True, timeout=20)
        if proc.returncode:
            raise ValueError(_cli_error(proc))
        entries = json.loads(proc.stdout or '[]')
    except (ValueError, subprocess.TimeoutExpired, OSError) as exc:
        return [], f'Could not list OpenCode sessions: {exc}'
    except ValueError as exc:
        return [], str(exc)
    repo_variants = {str(repo), str(Path(repo).resolve())}
    sessions = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        directory = entry.get('directory', '')
        if directory not in repo_variants:
            try:
                if str(Path(directory).resolve()) not in repo_variants:
                    continue
            except OSError:
                continue
        sessions.append(_enrich_opencode(entry))
    sessions.sort(key=lambda s: s['updated'], reverse=True)
    return sessions[:50], ''


def _enrich_opencode(entry):
    """Best-effort enrichment from the engine DB; CLI fields always survive."""
    sid = entry.get('id', '')
    info = {'id': sid, 'title': entry.get('title') or '(untitled)',
            'updated': _ms(entry.get('updated')), 'created': _ms(entry.get('created')),
            'directory': entry.get('directory', ''), 'agent': '', 'model': '',
            'cost': 0, 'tokens': 0, 'parent_id': None, 'children': 0, 'share_url': ''}
    try:
        rows = _ro(village_config.opencode_db(),
                   'SELECT agent, model, cost, tokens_input, tokens_output, tokens_reasoning,'
                   ' parent_id, share_url, time_updated FROM session WHERE id=?', (sid,))
        kids = _ro(village_config.opencode_db(),
                   'SELECT id FROM session WHERE parent_id=?', (sid,))
    except (sqlite3.Error, OSError):
        return info
    if rows:
        row = rows[0]
        try:
            model = json.loads(row['model'] or '{}')
            info['model'] = model.get('providerID', '') + '/' + model.get('id', '') if model.get('id') else ''
        except ValueError:
            pass
        info.update(agent=row['agent'] or '', cost=row['cost'] or 0,
                    tokens=sum((row[k] or 0) for k in ('tokens_input', 'tokens_output', 'tokens_reasoning')),
                    parent_id=row['parent_id'], share_url=row['share_url'] or '')
        if row['time_updated']:
            info['updated'] = row['time_updated'] / 1000
    info['children'] = len(kids)
    return info


def _ms(value):
    try:
        return float(value) / 1000
    except (TypeError, ValueError):
        return 0


def list_hermes(repo):
    """Engine-filtered, repo-scoped Hermes sessions from its own store."""
    if not village_config.resolve_engine('hermes')['command']:
        return [], 'Hermes CLI not found. ' + village_config.INSTALL_HINTS['hermes']
    db = _hermes_db()
    if not db.exists():
        return [], 'No Hermes session store found yet. Run Hermes once first.'
    like = str(repo) + '/%'
    try:
        rows = _ro(db,
            'SELECT id, title, source, model, cwd, message_count, tool_call_count,'
            ' input_tokens, output_tokens, estimated_cost_usd, actual_cost_usd,'
            ' started_at, last_activity_at, parent_session_id, pinned'
            " FROM sessions WHERE archived=0 AND hidden=0 AND source != 'tool'"
            " AND (parent_session_id IS NULL OR model_config IS NULL"
            " OR instr(COALESCE(model_config,''), '_delegate_from') = 0)"
            ' AND (git_repo_root = ? OR cwd = ? OR cwd LIKE ?)'
            ' ORDER BY COALESCE(last_activity_at, started_at) DESC LIMIT 50',
            (str(repo), str(repo), like))
    except sqlite3.Error as exc:
        return [], f'Could not read Hermes sessions: {exc}'
    sessions = []
    for row in rows:
        last = row['last_activity_at'] or row['started_at']
        sessions.append({
            'id': row['id'], 'title': row['title'] or '(untitled)',
            'updated': last or 0, 'created': row['started_at'] or 0,
            'source': row['source'], 'model': row['model'] or '',
            'cwd': row['cwd'] or '', 'messages': row['message_count'] or 0,
            'tools': row['tool_call_count'] or 0,
            'tokens': (row['input_tokens'] or 0) + (row['output_tokens'] or 0),
            'cost': row['actual_cost_usd'] or row['estimated_cost_usd'] or 0,
            'parent_id': row['parent_session_id'], 'pinned': bool(row['pinned']),
        })
    return sessions, ''


def describe_sessions(engine, repo):
    sessions, warning = list_opencode(repo) if engine == 'opencode' else list_hermes(repo)
    for item in sessions:
        item['ago'] = _rel_time(item['updated'])
    return {'sessions': sessions, 'warning': warning}


def session_exists(engine, sid):
    try:
        if engine == 'opencode':
            return bool(_ro(village_config.opencode_db(),
                            'SELECT 1 FROM session WHERE id=?', (sid,)))
        return bool(_ro(_hermes_db(), 'SELECT 1 FROM sessions WHERE id=?', (sid,)))
    except (sqlite3.Error, OSError):
        return True  # unreadable store: don't block dispatch; the run surfaces it


def child_count(engine, sid):
    try:
        if engine == 'opencode':
            return len(_ro(village_config.opencode_db(),
                           'SELECT id FROM session WHERE parent_id=?', (sid,)))
        return len(_ro(_hermes_db(),
                       "SELECT id FROM sessions WHERE parent_session_id=?"
                       " AND (source = 'subagent' OR instr(COALESCE(model_config,''), '_delegate_from') > 0)",
                       (sid,)))
    except (sqlite3.Error, OSError):
        return 0


def delete_session(engine, sid):
    """Delete on the engine side. Fork/subagent children block deletion."""
    kids = child_count(engine, sid)
    if kids:
        if engine == 'opencode':
            raise ValueError(
                f'This session has {kids} forked child session(s) on the engine side. '
                'Delete the children first — deleting the parent would orphan them.')
        raise ValueError(
            f'This session has {kids} subagent session(s) that the engine would '
            'cascade-delete with it. Delete or detach those first.')
    if engine == 'opencode':
        _run_cli('opencode', ['session', 'delete', sid])
    else:
        _run_cli('hermes', ['sessions', 'delete', sid, '--yes'])
    return True


def rename_session(engine, sid, title):
    """Rename on the engine side. Hermes only: OpenCode rename needs a serve daemon."""
    if engine != 'hermes':
        raise ValueError('Renaming OpenCode sessions needs `opencode serve` running — '
                         'not supported in this app yet. See docs/sessions.md.')
    title = (title or '').strip()
    if not title or '\n' in title or len(title) > TITLE_LIMIT:
        raise ValueError(f'Enter a title of 1–{TITLE_LIMIT} characters, no newlines.')
    _run_cli('hermes', ['sessions', 'rename', sid, title])
    return True


def check_title(title):
    title = (title or '').strip()
    if title and ('\n' in title or len(title) > TITLE_LIMIT):
        raise ValueError(f'Keep the session title to 1–{TITLE_LIMIT} characters, no newlines.')
    return title
