"""Project-scoped task runners. No shell interpolation; engine credentials stay local."""
import copy
import json
import os
import re
import signal
import subprocess
import threading
import time
import uuid
from pathlib import Path
from urllib.request import Request, urlopen

HOME = Path.home()
HERE = Path(__file__).resolve().parent
DATA = HERE / 'runs'
OPENCODE = '/opt/homebrew/bin/opencode'
HERMES = str(HOME / '.local/bin/hermes')
ROLES = ['ARCHITECT', 'CODER', 'TESTER', 'MANAGER']
ROLE_PROMPTS = {
    'ARCHITECT': 'Inspect the project and produce a concrete plan and acceptance criteria. Do not change application code.',
    'CODER': 'Implement the requested task following the project instructions. Run appropriate checks and report evidence.',
    'TESTER': 'Independently test the work against the requirements. Report exact checks, failures and limitations. Do not change application code.',
    'MANAGER': 'Review the requirements, implementation and testing evidence. Report unmet criteria and whether the work is ready for human review. Do not change application code.',
}
LOCK = threading.RLock()
JOBS = {}
PROCESSES = {}
MODEL_CACHE = {'at': 0, 'models': [], 'warnings': []}


def load_jobs():
    DATA.mkdir(exist_ok=True)
    for path in sorted(DATA.glob('*.json'))[-100:]:
        try:
            job = json.loads(path.read_text())
            if job['status'] in ('queued', 'running'):
                job['status'] = 'interrupted'
                job['error'] = 'Village restarted. This run is no longer monitored.'
            JOBS[job['id']] = job
        except (ValueError, KeyError):
            continue


def persist(job):
    temp = DATA / (job['id'] + '.tmp')
    temp.write_text(json.dumps(job, ensure_ascii=False))
    temp.replace(DATA / (job['id'] + '.json'))


def redact(text):
    text = re.sub(r'\x1b\[[0-9;]*[A-Za-z]', '', str(text))
    return re.sub(r'\b(?:sk-|sk-or-|AIza)[A-Za-z0-9_\-]{16,}', '[redacted]', text)


def event(job, text, kind='message', role=None):
    text = redact(text).strip()
    if not text:
        return
    with LOCK:
        job['events'].append({'id': uuid.uuid4().hex, 'ts': time.time(),
                              'author': role or job['current_agent'], 'kind': kind, 'text': text[:24000]})
        job['events'] = job['events'][-200:]
        persist(job)


def catalog():
    with LOCK:
        if time.time() - MODEL_CACHE['at'] < 120:
            return copy.deepcopy(MODEL_CACHE)
    models, warnings = [], []
    try:
        result = subprocess.run([OPENCODE, 'models'], capture_output=True, text=True, timeout=25)
        if result.returncode:
            raise RuntimeError('OpenCode model command failed')
        for line in result.stdout.splitlines():
            if re.fullmatch(r'[\w~.:/\-]+/[\w~.:/\-]+', line):
                models.append({'engine': 'opencode', 'id': line, 'label': line, 'source': 'OpenCode catalog'})
    except (OSError, subprocess.TimeoutExpired, RuntimeError) as exc:
        warnings.append(str(exc))
    try:
        cache = json.loads((HOME / '.hermes/provider_models_cache.json').read_text())
        for provider, entry in cache.items():
            for model in entry.get('models', []):
                if isinstance(model, str):
                    models.append({'engine': 'hermes', 'id': provider + '/' + model,
                                   'label': provider + '/' + model, 'source': 'Hermes cached catalog'})
    except (OSError, ValueError) as exc:
        warnings.append('Hermes model cache unavailable: ' + str(exc))
    with LOCK:
        MODEL_CACHE.update(at=time.time(), models=models, warnings=warnings)
        return copy.deepcopy(MODEL_CACHE)


def command(job, prompt):
    model = job['model']
    if job['engine'] == 'opencode':
        args = [OPENCODE, 'run', '--pure', '--format', 'json', '--dir', job['repo']]
        if model:
            args += ['--model', model]
        return args + ['--', prompt]
    args = [HERMES, 'chat', '--format', 'stream-json', '--in', job['repo'], '--max-turns', '60']
    if model:
        provider, name = model.split('/', 1)
        args += ['--provider', provider, '--model', name]
    return args + ['-q', prompt]


def provider_error(error):
    raw = json.dumps(error) if not isinstance(error, str) else error
    if 'free tier can only be used from within OpenCode' in raw:
        return ('OpenCode’s provider rejected this free-tier request (HTTP 403): its free tier can only be used from within OpenCode. '
                'Choose a different model provider, such as RapidScreen or OpenRouter, with valid credentials. '
                'The village cannot override this provider restriction.')
    if isinstance(error, dict):
        detail = error.get('data', error)
        if isinstance(detail, dict) and detail.get('message'):
            return redact(str(detail['message']))[:2000]
    return redact(raw)[:2000]


def stream_event(job, line):
    """Keep public text/tool summaries, not model reasoning or raw tool inputs."""
    try:
        item = json.loads(line)
    except ValueError:
        return ''
    kind = item.get('type', '')
    part = item.get('part') or {}
    if not isinstance(part, dict):
        part = {}
    if 'error' in kind or (kind == 'result' and (item.get('error') or item.get('exit_code'))):
        error = item.get('error') or item.get('message') or item
        raise RuntimeError(provider_error(error))
    if kind in ('text', 'assistant', 'message', 'message.delta', 'assistant_message', 'result'):
        text = part.get('text') or item.get('text') or item.get('content') or item.get('result') or ''
        if isinstance(text, str) and text.strip():
            event(job, text)
            return text
    if kind in ('tool_use', 'tool_call', 'tool.start', 'tool_call_start'):
        name = part.get('tool') or item.get('tool_name') or item.get('name') or 'tool'
        event(job, 'Using ' + str(name), 'tool')
        state = part.get('state') or {}
        if isinstance(state, dict) and state.get('status') in ('completed', 'error'):
            result = state.get('output') or state.get('error')
            if isinstance(result, str) and result.strip():
                event(job, str(name) + '\n' + result[:12000], 'tool_result')
    if kind in ('tool_result', 'tool.complete'):
        result = item.get('output') or item.get('result')
        if isinstance(result, str) and result.strip():
            event(job, str(item.get('name') or item.get('tool_name') or 'tool') + '\n' + result[:12000], 'tool_result')
    if kind in ('final', 'done', 'response'):
        text = item.get('final_response') or item.get('text') or item.get('response') or ''
        if isinstance(text, str) and text:
            event(job, text)
            return text
    return ''


def run_cli(job, prompt):
    with LOCK:
        if job['status'] == 'cancelled':
            return ''
        process = subprocess.Popen(command(job, prompt), cwd=job['repo'], env=os.environ.copy(),
                                   stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   text=True, start_new_session=True, bufsize=1)
        PROCESSES[job['id']] = process
    errors, output = [], []
    def drain():
        for line in process.stderr:
            errors.append(redact(line))
            del errors[:-40]
    reader = threading.Thread(target=drain, daemon=True)
    reader.start()
    timer = threading.Timer(1800, lambda: terminate(job['id']))
    timer.start()
    try:
        for line in process.stdout:
            text = stream_event(job, line)
            if text:
                output.append(text)
        code = process.wait()
        reader.join(timeout=2)
        if job['status'] == 'cancelled':
            return ''
        if code:
            raise RuntimeError('Engine exited with code ' + str(code) + ': ' + ''.join(errors)[-3000:])
        if not output:
            event(job, 'Engine finished without a public text response. ' + ''.join(errors)[-1000:], 'status')
        return '\n'.join(output)[-40000:]
    finally:
        timer.cancel()
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
        process.stdout.close()
        process.stderr.close()
        with LOCK:
            PROCESSES.pop(job['id'], None)


def direct_llm(job, prompt):
    # An OpenAI-compatible endpoint is chat-only, not a filesystem agent.
    key = os.environ.get(job.get('key_env', ''), '')
    headers = {'Content-Type': 'application/json'}
    if key:
        headers['Authorization'] = 'Bearer ' + key
    payload = {'model': job['model'], 'messages': [{'role': 'user', 'content': prompt}], 'stream': False}
    req = Request(job['base_url'].rstrip('/') + '/chat/completions',
                  data=json.dumps(payload).encode(), headers=headers)
    with urlopen(req, timeout=180) as response:
        data = json.load(response)
    text = data['choices'][0]['message']['content']
    if job['status'] == 'cancelled':
        return ''
    event(job, text)
    return text


def run(job):
    try:
        with LOCK:
            if job['status'] == 'cancelled':
                return
            job['status'] = 'running'
        context = job.pop('context', '')
        roles = ROLES if job['role'] == 'TEAM' else [job['role']]
        for role in roles:
            with LOCK:
                if job['status'] == 'cancelled':
                    return
                job['current_agent'] = role
            event(job, role.title() + ' started', 'status')
            prompt = ('You are the ' + role + ' on a development team. ' + ROLE_PROMPTS[role]
                      + '\nProject: ' + job['repo'] + '\nUser task:\n' + job['message']
                      + ('\nPrevious conversation / role reports:\n' + context[-45000:] if context else '')
                      + '\nUse the selected engine directly. Do not launch a different coding engine. '
                        'Do not commit or push unless the user requested it. Clearly report anything not verified.')
            result = direct_llm(job, prompt) if job['engine'] == 'llm' else run_cli(job, prompt)
            context += '\n' + role + ':\n' + result
        with LOCK:
            if job['status'] != 'cancelled':
                job['status'] = 'completed'
                event(job, 'Run finished. Review the evidence in the conversation.', 'status')
    except Exception as exc:
        with LOCK:
            if job['status'] != 'cancelled':
                job['status'] = 'failed'
                job['error'] = redact(str(exc))
                event(job, job['error'], 'error')
    finally:
        with LOCK:
            job['finished_at'] = time.time()
            persist(job)


def submit(body):
    repo = Path(body.get('repo', '')).expanduser().resolve(strict=True)
    if not repo.is_dir():
        raise ValueError('Select a project folder')
    engine = body.get('engine')
    if engine not in ('opencode', 'hermes', 'llm'):
        raise ValueError('Choose OpenCode, Hermes or a compatible LLM')
    role = body.get('role', 'CODER')
    if role not in ROLES + ['TEAM']:
        raise ValueError('Unknown role')
    message = body.get('message', '').strip()
    model = body.get('model', '').strip()
    if not message or len(message) > 30000:
        raise ValueError('Enter a task of 1–30,000 characters')
    if engine != 'llm' and model and '/' not in model:
        raise ValueError('Use a provider/model identifier')
    if engine == 'llm':
        from urllib.parse import urlparse
        url = urlparse(body.get('base_url', ''))
        if url.scheme not in ('http', 'https') or not url.hostname or url.username or url.password or not model:
            raise ValueError('Enter a valid HTTP(S) API base URL and model')
    with LOCK:
        if any(j['repo'] == str(repo) and j['status'] in ('running', 'queued') for j in JOBS.values()):
            raise ValueError('This project already has a running task. Wait or stop it first.')
        context = ''
        previous = JOBS.get(body.get('previous_id'))
        if previous and previous['repo'] == str(repo) and previous['engine'] == engine:
            context = previous['message'] + '\n' + '\n'.join(e['text'] for e in previous['events'] if e['kind'] == 'message')
        job = {'id': uuid.uuid4().hex, 'repo': str(repo), 'engine': engine, 'model': model,
               'role': role, 'current_agent': roles_first(role), 'message': message,
               'status': 'queued', 'created_at': time.time(), 'events': [], 'context': context,
               'base_url': body.get('base_url', ''), 'key_env': body.get('key_env', '')}
        JOBS[job['id']] = job
        persist(job)
        threading.Thread(target=run, args=(job,), daemon=True).start()
        return copy.deepcopy(job)


def roles_first(role):
    return ROLES[0] if role == 'TEAM' else role


def terminate(job_id):
    with LOCK:
        job = JOBS.get(job_id)
        if not job:
            raise ValueError('Unknown run')
        if job['status'] not in ('queued', 'running'):
            return
        job['status'] = 'cancelled'
        process = PROCESSES.get(job_id)
        if process and process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
            def kill_later():
                if process.poll() is None:
                    os.killpg(process.pid, signal.SIGKILL)
            threading.Timer(5, kill_later).start()
        event(job, 'Run stopped by user or time limit.', 'status')


def jobs_for(repo, engine):
    with LOCK:
        return copy.deepcopy(sorted([j for j in JOBS.values() if j['repo'] == repo and j['engine'] == engine],
                                    key=lambda j: j['created_at'])[-15:])
