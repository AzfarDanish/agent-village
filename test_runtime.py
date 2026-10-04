"""Contract tests use temporary projects and real subprocess/HTTP boundaries."""
import json
import sys
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

import runtime
import server


class VillageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        self.data = self.root / 'runs'
        self.data.mkdir()
        self.other = self.root / 'other'
        self.other.mkdir()
        self.patch = patch.object(runtime, 'DATA', self.data)
        self.patch.start()
        runtime.JOBS.clear()

    def tearDown(self):
        for ident in list(runtime.PROCESSES):
            runtime.terminate(ident)
        self.patch.stop()
        self.temp.cleanup()

    def wait(self, job):
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if job.get('finished_at'):
                return
            time.sleep(.02)
        self.fail('Run did not finish')

    def test_free_tier_rejection_is_actionable(self):
        error = {'name': 'APIError', 'data': {'message': "OpenCode's free tier can only be used from within OpenCode", 'statusCode': 403}}
        with self.assertRaisesRegex(RuntimeError, 'Choose a different model provider'):
            runtime.stream_event({}, json.dumps({'type': 'error', 'error': error}))
        self.assertNotIn('responseHeaders', runtime.provider_error(error))

    def test_config_defaults_and_version_guard(self):
        import config as village_config
        try:
            cfg = village_config.load(str(self.root / 'nonexistent.json'))
            self.assertEqual(cfg['version'], village_config.CONFIG_VERSION)
            self.assertEqual(cfg['port'], 8787)
            bad = self.root / 'village.json'
            bad.write_text('{"version": 999}')
            with self.assertRaises(ValueError):
                village_config.load(str(bad))
            missing = village_config.resolve_engine('village-no-such-engine-xyz')
            self.assertIsNone(missing['command'])
        finally:
            village_config.load()

    def test_session_attach_flags_and_validation(self):
        base = {'engine': 'opencode', 'model': '', 'repo': str(self.root),
                'session_id': '', 'new_title': ''}
        args = runtime.command({**base}, 'do it')
        self.assertNotIn('--session', args)
        self.assertNotIn('--title', args)
        args = runtime.command({**base, 'session_id': 'ses_abc123'}, 'do it')
        self.assertEqual(args[args.index('--session') + 1], 'ses_abc123')
        args = runtime.command({**base, 'new_title': 'Big refactor'}, 'do it')
        self.assertEqual(args[args.index('--title') + 1], 'Big refactor')
        with self.assertRaises(ValueError):
            runtime.check_session_id('opencode', 'not a session!!')
        hermes = {**base, 'engine': 'hermes', 'session_id': '20240101_120000_ab12cd'}
        args = runtime.command(hermes, 'do it')
        self.assertEqual(args[args.index('--resume') + 1], '20240101_120000_ab12cd')
        llm = {**base, 'engine': 'llm', 'session_id': 'ses_abc123'}
        self.assertNotIn('--session', runtime.command(llm, 'do it'))

    def test_submit_session_rules(self):
        good = {'repo': str(self.root), 'engine': 'opencode', 'message': 'hi'}
        with patch.object(runtime, 'command', lambda *_: [sys.executable, '-c', 'print("{}")']):
            receipt = runtime.submit({**good, 'session_id': 'ses_abc123'})
            job = runtime.JOBS[receipt['id']]
            self.wait(job)
            self.assertEqual(job['session_id'], 'ses_abc123')
            receipt = runtime.submit({**good, 'new_session': True, 'new_title': 'Fresh'})
            job = runtime.JOBS[receipt['id']]
            self.wait(job)
            self.assertEqual((job['new_title'], job['session_id'], job['status']), ('Fresh', '', 'completed'))
        with self.assertRaises(ValueError):
            runtime.submit({**good, 'session_id': 'ses_x', 'new_session': True})
        with self.assertRaises(ValueError):
            runtime.submit({**good, 'session_id': 'bogus id!!'})

    def test_stream_captures_engine_session(self):
        job = {'id': 'stream-test', 'current_agent': 'CODER', 'engine_session': '', 'events': []}
        runtime.stream_event(job, json.dumps({'type': 'result', 'session_id': 'abc123', 'text': 'hi'}))
        self.assertEqual(job['engine_session'], 'abc123')
        job = {'id': 'stream-test', 'current_agent': 'CODER', 'engine_session': '', 'events': []}
        runtime.stream_event(job, json.dumps({'type': 'text', 'sessionID': 'ses_9', 'text': 'hi'}))
        self.assertEqual(job['engine_session'], 'ses_9')

    def test_session_store_helpers(self):
        import sessions
        with self.assertRaises(ValueError):
            sessions.check_title('has\nnewline')
        with self.assertRaises(ValueError):
            sessions.rename_session('opencode', 'ses_x', 'whatever')
        with self.assertRaises(ValueError):
            sessions.delete_session('opencode', 'ses_definitely_missing_123')
        result = sessions.describe_sessions('opencode', self.root)
        self.assertIn('sessions', result)
        self.assertIsInstance(result['warning'], str)
        for item in result['sessions']:
            self.assertTrue(item['id'] and item['title'])

    def test_tool_results_are_separate_from_messages(self):
        job = {'id': 'tool-test', 'current_agent': 'TESTER', 'events': []}
        runtime.stream_event(job, json.dumps({'type': 'tool_result', 'name': 'bash', 'output': '3 checks passed'}))
        self.assertEqual(job['events'][0]['kind'], 'tool_result')
        self.assertIn('3 checks passed', job['events'][0]['text'])

    def test_cli_arguments_preserve_prompt_and_engine_model(self):
        prompt = 'Do not execute $(touch oops); "quoted"\nsecond line'
        job = {'engine': 'opencode', 'model': 'vendor/model/name', 'repo': str(self.root)}
        args = runtime.command(job, prompt)
        self.assertEqual(args[-2:], ['--', prompt])
        self.assertEqual(args[args.index('--dir') + 1], str(self.root))
        job['engine'] = 'hermes'
        args = runtime.command(job, prompt)
        self.assertEqual(args[args.index('--provider') + 1], 'vendor')
        self.assertEqual(args[args.index('--model') + 1], 'model/name')
        self.assertEqual(args[-1], prompt)

    def test_real_subprocess_team_order_scope_and_failure(self):
        def command(job, prompt):
            return [sys.executable, '-c', 'import json,os; print(json.dumps({"type":"text","text":os.getcwd()}))']
        with patch.object(runtime, 'command', command):
            receipt = runtime.submit({'repo': str(self.root), 'engine': 'opencode', 'role': 'TEAM', 'message': 'Inspect only'})
            job = runtime.JOBS[receipt['id']]
            self.wait(job)
        self.assertEqual(job['status'], 'completed')
        events = [e for e in job['events'] if e['kind'] == 'message']
        self.assertEqual([e['author'] for e in events], runtime.ROLES)
        self.assertTrue(all(e['text'] == str(self.root) for e in events))
        self.assertFalse(runtime.jobs_for(str(self.root), 'hermes'))
        self.assertFalse(runtime.jobs_for(str(self.other), 'opencode'))
        self.assertEqual(json.loads((self.data / (job['id'] + '.json')).read_text())['status'], 'completed')
        with patch.object(runtime, 'command', lambda *_: [sys.executable, '-c', 'import sys; sys.stderr.write("expected failure"); sys.exit(7)']):
            receipt = runtime.submit({'repo': str(self.other), 'engine': 'hermes', 'message': 'Inspect only'})
            job = runtime.JOBS[receipt['id']]
            self.wait(job)
        self.assertEqual(job['status'], 'failed')
        self.assertIn('expected failure', job['error'])

    def test_cancellation_and_project_exclusion(self):
        with patch.object(runtime, 'command', lambda *_: [sys.executable, '-c', 'import time; time.sleep(30)']):
            receipt = runtime.submit({'repo': str(self.root), 'engine': 'opencode', 'message': 'Wait'})
            job = runtime.JOBS[receipt['id']]
            deadline = time.monotonic() + 5
            while job['id'] not in runtime.PROCESSES and time.monotonic() < deadline:
                time.sleep(.02)
            with self.assertRaises(ValueError):
                runtime.submit({'repo': str(self.root), 'engine': 'hermes', 'message': 'Another run'})
            runtime.terminate(job['id'])
            self.wait(job)
        self.assertEqual(job['status'], 'cancelled')

    def test_compatible_endpoint_and_historical_state(self):
        class Endpoint(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass
            def do_POST(self):
                data = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                self.server.received = data
                body = json.dumps({'choices': [{'message': {'content': 'LOCAL_ENDPOINT_OK'}}]}).encode()
                self.send_response(200)
                self.end_headers()
                self.wfile.write(body)
        endpoint = ThreadingHTTPServer(('127.0.0.1', 0), Endpoint)
        threading.Thread(target=endpoint.serve_forever, daemon=True).start()
        try:
            receipt = runtime.submit({'repo': str(self.root), 'engine': 'llm', 'model': 'test-model',
                                      'base_url': f'http://127.0.0.1:{endpoint.server_port}/v1', 'message': 'Hello'})
            job = runtime.JOBS[receipt['id']]
            self.wait(job)
            self.assertEqual(job['status'], 'completed')
            self.assertEqual(endpoint.received['model'], 'test-model')
            self.assertTrue(any(e['text'] == 'LOCAL_ENDPOINT_OK' for e in job['events']))
        finally:
            endpoint.shutdown()
            endpoint.server_close()
        team = self.root / 'TEAM'
        team.mkdir()
        (team / 'state.json').write_text(json.dumps({'status': 'reviewing', 'current_agent': 'MANAGER'}))
        result = server.state(self.root, 'hermes')
        self.assertEqual(result['status'], 'idle')
        self.assertIsNone(result['current_agent'])
        self.assertFalse(result['meeting'])


if __name__ == '__main__':
    unittest.main()
