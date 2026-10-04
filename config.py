"""Versioned local config + engine-binary discovery. Standard library only.

Looks for ``village.json`` next to this file (never committed; see
``village.example.json``). Missing file or missing keys both fall back to
defaults, so the app runs with zero config.

Schema version is ``CONFIG_VERSION``. A config file with a newer ``version``
than this code understands is rejected loudly instead of being half-read.
"""
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONFIG_VERSION = 1
CONFIG_NAME = 'village.json'
EXAMPLE_NAME = 'village.example.json'

DEFAULTS = {
    'version': CONFIG_VERSION,
    'host': '127.0.0.1',
    'port': 8787,
    'defaults': {'engine': 'opencode', 'model': '', 'role': 'CODER', 'repo': ''},
    'project_roots': ['~/Documents/GitHub'],
    'run_timeout_s': 1800,
    'max_message_chars': 30000,
    'engines': {
        'opencode': {'command': '', 'extra_args': []},
        'hermes': {'command': '', 'extra_args': []},
    },
    'paths': {'hermes_home': '', 'opencode_db': ''},
}

# Fallback install locations checked after PATH, per platform.
PLATFORM_EXTRA_PATHS = {
    'opencode': [
        '/opt/homebrew/bin/opencode',          # macOS Homebrew (Apple Silicon)
        '/usr/local/bin/opencode',             # macOS Homebrew (Intel) / Linux
        str(Path.home() / '.local/bin/opencode'),
    ],
    'hermes': [
        str(Path.home() / '.local/bin/hermes'),
    ],
}

INSTALL_HINTS = {
    'opencode': 'Install OpenCode (https://opencode.ai) and ensure `opencode` is on PATH, or set engines.opencode.command in village.json.',
    'hermes': 'Install Hermes Agent and ensure `hermes` is on PATH, or set engines.hermes.command in village.json.',
}

_state = {'config': None, 'availability': {}, 'availability_at': 0}


def _merge(base, override):
    """Deep-merge dicts; unknown keys are kept so future versions warn, not break."""
    merged = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def load(path=None):
    """Load config from *path* (default: village.json next to this file)."""
    raw = {}
    candidate = Path(path).expanduser() if path else HERE / CONFIG_NAME
    if candidate.exists():
        try:
            raw = json.loads(candidate.read_text(encoding='utf-8'))
        except ValueError as exc:
            raise ValueError(f'Invalid JSON in {candidate}: {exc}')
        if not isinstance(raw, dict):
            raise ValueError(f'{candidate} must contain a JSON object')
        version = raw.get('version', CONFIG_VERSION)
        if not isinstance(version, int) or version > CONFIG_VERSION:
            raise ValueError(
                f'{candidate} has version {version!r} but this code supports up to '
                f'version {CONFIG_VERSION}. Update the app, not the file.')
        if version < CONFIG_VERSION:
            raise ValueError(
                f'{candidate} has version {version!r}; this code expects version '
                f'{CONFIG_VERSION}. See {EXAMPLE_NAME} and docs/configuration.md.')
    config = _merge(DEFAULTS, raw)
    if config['defaults'].get('engine') not in ('opencode', 'hermes', 'llm'):
        raise ValueError('defaults.engine must be one of: opencode, hermes, llm')
    _state['config'] = config
    _state['availability'] = {}
    return config


def get():
    if _state['config'] is None:
        return load()
    return _state['config']


def hermes_home():
    override = get()['paths'].get('hermes_home', '')
    return Path(override).expanduser() if override else Path.home() / '.hermes'


def opencode_db():
    override = get()['paths'].get('opencode_db', '')
    if override:
        return Path(override).expanduser()
    return Path.home() / '.local' / 'share' / 'opencode' / 'opencode.db'


def resolve_engine(name):
    """Return {'command', 'source', 'version'} for an engine, or command None."""
    cfg = get()['engines'].get(name, {})
    explicit = (cfg.get('command') or '').strip()
    candidates = ([explicit] if explicit else []) + [name] + PLATFORM_EXTRA_PATHS.get(name, [])
    for candidate in candidates:
        if '/' in candidate or '\\' in candidate:
            if not Path(candidate).is_file():
                continue
            found = candidate
        else:
            found = shutil.which(candidate)
            if not found:
                continue
        source = 'config' if candidate == explicit else ('PATH' if candidate == name else 'known-location')
        return {'command': found, 'source': source, 'version': _probe_version(found)}
    return {'command': None, 'source': None, 'version': None}


def _probe_version(command):
    try:
        result = subprocess.run([command, '--version'], capture_output=True, text=True, timeout=8)
        output = (result.stdout + result.stderr).strip().splitlines()
        return output[0][:80] if output and result.returncode == 0 else None
    except (OSError, subprocess.TimeoutExpired):
        return None


def availability():
    """Cached engine availability for the /config endpoint (probes are slow)."""
    if time.time() - _state['availability_at'] < 120 and _state['availability']:
        return _state['availability']
    info = {}
    for name in ('opencode', 'hermes'):
        resolved = resolve_engine(name)
        info[name] = {**resolved, 'hint': None if resolved['command'] else INSTALL_HINTS[name]}
    _state['availability'] = info
    _state['availability_at'] = time.time()
    return info


def public_config():
    """Non-sensitive snapshot for the UI and for `server.py --print-config`."""
    cfg = get()
    return {
        'version': CONFIG_VERSION,
        'defaults': cfg['defaults'],
        'project_roots': cfg['project_roots'],
        'run_timeout_s': cfg['run_timeout_s'],
        'max_message_chars': cfg['max_message_chars'],
        'engines': availability(),
    }


def python_info():
    return {'version': sys.version.split()[0], 'ok': sys.version_info >= (3, 10)}
