#!/usr/bin/env python3
"""Local 3D agent village. Run with python3 server.py."""
import argparse
import json
import mimetypes
import sqlite3
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

import config as village_config
import runtime
from legacy import read_artifact, read_memories, read_team_state, parse_talks

HOME = Path.home()
HERE = Path(__file__).resolve().parent
WEB = HERE / 'web'


def folder(value):
    path = Path(value or HOME).expanduser().resolve(strict=True)
    if not path.is_dir():
        raise ValueError('Not a folder')
    return path


def folders(value):
    path = folder(value)
    children = []
    for child in sorted(path.iterdir(), key=lambda p: p.name.lower()):
        if not child.name.startswith('.') and child.is_dir():
            children.append({'name': child.name, 'path': str(child.resolve())})
    return {'path': str(path), 'parent': str(path.parent), 'folders': children[:500]}


def opencode_history(repo):
    db = village_config.opencode_db()
    if not db.exists():
        return [], 'No OpenCode history database found'
    try:
        with sqlite3.connect(f'file:{db}?mode=ro', uri=True, timeout=2) as con:
            row = con.execute('SELECT id FROM session WHERE directory=? ORDER BY time_updated DESC LIMIT 1', (str(repo),)).fetchone()
            if not row:
                return [], ''
            rows = con.execute('SELECT id,data FROM part WHERE session_id=? ORDER BY rowid DESC LIMIT 40', (row[0],)).fetchall()
            talks = []
            for part_id, raw in reversed(rows):
                part = json.loads(raw)
                if part.get('type') == 'text' and part.get('text'):
                    talks.append({'id': part_id, 'author': 'OpenCode', 'text': part['text'][:4000], 'kind': 'history'})
            return talks[-12:], ''
    except (sqlite3.Error, ValueError) as exc:
        return [], 'OpenCode history unavailable: ' + str(exc)


def state(repo, engine):
    if engine not in ('opencode', 'hermes', 'llm'):
        raise ValueError('Invalid engine')
    jobs = runtime.jobs_for(str(repo), engine)
    latest = jobs[-1] if jobs else None
    warning, talks, memories, team = '', [], [], {}
    if engine == 'hermes':
        team = read_team_state(repo) or {}
        talks = parse_talks(repo)
        memories = read_memories()
    elif engine == 'opencode':
        talks, warning = opencode_history(repo)
    active = latest and latest['status'] in ('queued', 'running')
    return {'repo': str(repo), 'project': repo.name, 'engine': engine,
            'status': latest['status'] if latest else 'idle',
            'current_agent': latest['current_agent'] if active else None,
            'meeting': bool(active and latest['current_agent'] == 'MANAGER'),
            'jobs': jobs, 'talks': talks, 'memories': memories,
            'open_issues': team.get('open_issues', []),
            'historical_team_status': team.get('status'), 'warning': warning}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def allowed(self):
        host = self.headers.get('Host', '')
        allowed = {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}
        if host not in allowed:
            return False
        origin = self.headers.get('Origin')
        return not origin or origin in {'http://' + h for h in allowed}

    def send(self, data, status=200, content_type='application/json'):
        body = data if isinstance(data, bytes) else json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', content_type + '; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        if not self.allowed():
            return self.send({'error': 'Local origin required'}, 403)
        url = urlparse(self.path)
        query = parse_qs(url.query)
        get = lambda key, default='': query.get(key, [default])[0]
        try:
            if url.path == '/api/village/models':
                return self.send(runtime.catalog())
            if url.path == '/api/village/folders':
                return self.send(folders(get('path')))
            if url.path == '/api/village/config':
                return self.send(village_config.public_config())
            if url.path == '/api/village/repos':
                repos = []
                for root in village_config.get()['project_roots']:
                    base = Path(root).expanduser()
                    if base.is_dir():
                        repos += [str(p) for p in sorted(base.iterdir())
                                  if p.is_dir() and not p.name.startswith('.')]
                return self.send({'repos': repos[:50], 'home': str(HOME)})
            if url.path == '/api/village/state':
                return self.send(state(folder(get('repo')), get('engine', 'opencode')))
            if url.path == '/api/village/artifacts':
                repo = folder(get('repo'))
                return self.send({'artifacts': {k: read_artifact(repo, k, 80000) for k in
                                               ('brief', 'plan', 'report', 'test_report', 'review', 'history')}})
            relative = unquote(url.path).lstrip('/') or 'index.html'
            path = (WEB / relative).resolve()
            if not path.is_relative_to(WEB) or not path.is_file() or path.suffix not in ('.html', '.js', '.css', '.svg', '.ico'):
                return self.send({'error': 'Not found'}, 404)
            return self.send(path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'text/plain')
        except (OSError, ValueError) as exc:
            self.send({'error': str(exc)}, 400)

    def do_POST(self):
        if not self.allowed() or self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
            return self.send({'error': 'Same-origin JSON request required'}, 403)
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if size <= 0 or size > 100000:
                raise ValueError('Invalid request size')
            body = json.loads(self.rfile.read(size))
            if not isinstance(body, dict):
                raise ValueError('Expected an object')
            if self.path == '/api/village/dispatch':
                return self.send(runtime.submit(body), 202)
            if self.path == '/api/village/stop':
                runtime.terminate(body.get('id'))
                return self.send({'ok': True})
            self.send({'error': 'Not found'}, 404)
        except (ValueError, OSError, TypeError) as exc:
            self.send({'error': str(exc)}, 400)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Local 3D agent village. See README.md and docs/.')
    parser.add_argument('--port', type=int, default=None)
    parser.add_argument('--host', choices=['127.0.0.1'], default=None)
    parser.add_argument('--config', default=None, help='Path to village.json (default: village.json next to server.py)')
    parser.add_argument('--print-config', action='store_true', help='Print resolved config and exit')
    args = parser.parse_args()
    cfg = village_config.load(args.config)
    args.host = args.host or cfg['host']
    args.port = args.port or cfg['port']
    if args.print_config:
        print(json.dumps(village_config.public_config(), indent=2))
        raise SystemExit(0)
    runtime.load_jobs()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f'Village: http://{args.host}:{args.port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        for job_id in list(runtime.PROCESSES):
            runtime.terminate(job_id)
        server.server_close()
