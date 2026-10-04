#!/usr/bin/env python3
"""Preserved v1 implementation and TEAM/memory readers.
Serves web/ + JSON adapters over TEAM/state.json, opencode.db, memories.
Usage: python3 server.py [--port 8787] [--host 127.0.0.1]
"""
import argparse, json, os, re, sqlite3, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote

HOME = Path.home()
HERMES = HOME / ".hermes"
OPencode_DB = HOME / ".local" / "share" / "opencode" / "opencode.db"
MEM_DIR = HERMES / "memories"
HERE = Path(__file__).resolve().parent
WEB = HERE / "web"

try:
    import config as _village_config

    def _mem_dir():
        override = _village_config.get()['paths'].get('hermes_home', '')
        return Path(override).expanduser() / 'memories' if override else MEM_DIR
except ImportError:  # used standalone without the new config module
    def _mem_dir():
        return MEM_DIR

STATUS_TO_AGENT = {
    "architecting": "ARCHITECT",
    "implementing": "CODER",
    "testing": "TESTER",
    "reviewing": "MANAGER",
}
ROLES = ["ARCHITECT", "CODER", "TESTER", "MANAGER"]

# RapidScreen catalog (opencode provider `rapidscreen`, baseURL litellm.rapidscreen.io/v1)
# Keep in sync with ~/.config/opencode/opencode.jsonc provider.rapidscreen.models
RAPIDSCREEN_MODELS = [
    "gpt-5.5",
    "gpt-5.4",
    "gpt-5.4-mini",
    "gpt-5.4-nano",
    "gpt-5.6-sol",
    "gpt-5.6-luna",
    "gpt-5.6-terra",
    "deepseek-v4-flash",
    "gpt-6-astra",
    "gpt-6-sol",
    "gpt-6-luna",
]

def list_models():
    """Union catalog for the village model picker. Tries live opencode config first."""
    models = list(RAPIDSCREEN_MODELS)
    # merge any extra models declared in opencode.jsonc (so manual edits show up)
    try:
        cfg = HOME / ".config" / "opencode" / "opencode.jsonc"
        if cfg.exists():
            raw = cfg.read_text(encoding="utf-8")
            for m in re.findall(r'"(gpt-[\w.\-]+|deepseek-[\w.\-]+|claude-[\w.\-]+)"\s*:\s*\{\s*"name"', raw):
                if m not in models:
                    models.append(m)
    except Exception:
        pass
    return [{"provider": "rapidscreen", "id": m, "label": f"rapidscreen/{m}"} for m in models]

def read_team_state(repo: Path):
    f = repo / "TEAM" / "state.json"
    if not f.exists():
        return None
    try:
        return json.loads(f.read_text(encoding="utf-8"))
    except Exception as e:
        return {"_error": str(e)}

def read_artifact(repo: Path, name: str, limit: int = 4000):
    mapping = {"brief":"brief.md","plan":"plan.md","report":"report.md",
               "test_report":"test-report.md","review":"review.md","history":"history.md"}
    p = repo / "TEAM" / mapping.get(name, name)
    if not p.exists():
        return ""
    try:
        t = p.read_text(encoding="utf-8", errors="replace")
        return t[-limit:] if len(t) > limit else t
    except Exception:
        return ""

def parse_talks(repo: Path, limit: int = 20):
    talks = []
    h = repo / "TEAM" / "history.md"
    if h.exists():
        try:
            lines = h.read_text(encoding="utf-8", errors="replace").splitlines()
            for ln in lines:
                m = re.match(r"#{2,4}\s*(ARCHITECT|CODER|TESTER|MANAGER|Iteration \d+)[^\n]*", ln)
                if m:
                    talks.append({"author": m.group(1), "kind": "status",
                                  "text": ln.strip("# ").strip()[:220], "ts": int(h.stat().st_mtime)})
                elif ln.strip().startswith("- ") and len(ln.strip()) > 4:
                    pass
            # last substantive bullets as conclusions
            bullets = [l.strip()[2:][:220] for l in lines if l.strip().startswith("- ")]
            for b in bullets[-8:]:
                talks.append({"author": "TEAM", "kind": "conclusion", "text": b,
                              "ts": int(h.stat().st_mtime)})
        except Exception:
            pass
    return talks[-limit:]

def opencode_latest(limit_talks: int = 10):
    """Read-only snapshot from opencode.db (mode=ro). Returns (sessions, talks)."""
    if not OPencode_DB.exists():
        return [], []
    try:
        con = sqlite3.connect(f"file:{OPencode_DB}?mode=ro", uri=True, timeout=5)
        cur = con.cursor()
        cur.execute("SELECT id,title,directory,agent,time_updated FROM session ORDER BY time_updated DESC LIMIT 8")
        sessions = [{"id": r[0], "title": r[1], "directory": r[2], "agent": r[3]} for r in cur.fetchall()]
        talks = []
        if sessions:
            sid = sessions[0][ "id"] if isinstance(sessions[0], dict) else sessions[0][0]
            try:
                cur.execute("""SELECT p.data FROM part p JOIN message m ON m.id=p.message_id
                             WHERE m.session_id=? ORDER BY p.rowid DESC LIMIT ?""", (sessions[0]["id"], limit_talks))
                import json as js
                for (d,) in cur.fetchall():
                    try:
                        o = js.loads(d) if isinstance(d, str) else {}
                        t = o.get("text") or o.get("tool") or ""
                        if t:
                            talks.append({"author": "opencode:" + str(o.get("tool") or o.get("type") or "agent"),
                                          "kind": "tool" if o.get("tool") else "conclusion",
                                          "text": str(t)[:220], "ts": int(time.time())})
                    except Exception:
                        continue
            except Exception:
                pass
        con.close()
        return sessions, talks
    except Exception:
        return [], []

def read_memories():
    cards = []
    for name in ("MEMORY.md", "USER.md"):
        p = _mem_dir() / name
        if p.exists():
            try:
                entries = [e.strip() for e in p.read_text(encoding="utf-8-sig").split("\n§\n") if e.strip()]
                for e in entries:
                    cards.append({"source": name, "text": e[:280]})
            except Exception:
                continue
    return cards

def discover_repos():
    repos = []
    # 1. default send2u example
    cand = HOME / "Documents" / "GitHub" / "send2u"
    if (cand / "TEAM" / "state.json").exists():
        repos.append(str(cand))
    # 2. scan ~/Documents/GitHub for TEAM dirs (max 10)
    gh = HOME / "Documents" / "GitHub"
    if gh.exists():
        for child in sorted(gh.iterdir())[:30]:
            if child.is_dir() and (child / "TEAM" / "state.json").exists() and str(child) not in repos:
                repos.append(str(child))
                if len(repos) >= 10:
                    break
    # 3. cwd fallback
    if not repos:
        repos.append(str(Path.cwd()))
    return repos

def build_state(repo_str: str):
    repo = Path(repo_str).expanduser() if repo_str else Path(discover_repos()[0])
    team = read_team_state(repo)
    oc_sessions, oc_talks = opencode_latest()
    talks = parse_talks(repo) + oc_talks[-6:]
    talks = talks[-20:]
    memories = read_memories()
    if team and "current_agent" in team:
        provider = "hermes"
        current = team.get("current_agent", "MANAGER")
        status = team.get("status", "reviewing")
        iteration = team.get("iteration", 1)
    elif oc_sessions:
        provider = "opencode"
        current, status, iteration = "CODER", "implementing", 1
        team = {"project": oc_sessions[0].get("title") or repo.name, "slug": oc_sessions[0]["id"][:12],
                "iteration": 1, "status": status, "current_agent": current,
                "open_issues": [], "decisions": [], "classifications": []}
    else:
        provider, current, status, iteration = "hermes", "MANAGER", "reviewing", 1
        team = team or {"project": repo.name, "iteration": 1, "status": status, "current_agent": current,
                        "open_issues": [], "decisions": [], "classifications": []}
    # meeting signal: reviewing / NEEDS_* / READY_FOR_CEO
    blob = json.dumps(team).upper()
    meeting = status in ("reviewing", "needs_clarification", "ready_for_ceo", "blocked") or \
              ("NEEDS_FIXES" in blob or "READY_FOR_CEO" in blob)
    return {
        "repo": str(repo), "provider": provider,
        "project": team.get("project", repo.name), "slug": team.get("slug", ""),
        "iteration": iteration, "status": status, "current_agent": current,
        "meeting": meeting,
        "open_issues": team.get("open_issues", [])[:12],
        "decisions": team.get("decisions", [])[:12],
        "classifications": team.get("classifications", [])[-6:],
        "validation": team.get("validation", {}),
        "talks": talks,
        "memories": memories[:12],
        "opencode_sessions": oc_sessions[:6],
        "ts": int(time.time()),
    }

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _send(self, body: bytes, ctype="application/json"):
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        repo = unquote(q.get("repo", [""])[0])
        if not repo:
            repos = discover_repos()
            repo = repos[0]
        if u.path in ("/", "/index.html"):
            self._send((WEB / "index.html").read_bytes(), "text/html")
        elif u.path == "/app.js":
            self._send((WEB / "app.js").read_bytes(), "text/javascript")
        elif u.path == "/style.css":
            self._send((WEB / "style.css").read_bytes(), "text/css")
        elif u.path == "/api/village/state":
            self._send(json.dumps(build_state(repo)).encode())
        elif u.path == "/api/village/artifacts":
            st = read_team_state(Path(repo)) or {}
            arts = {k: read_artifact(Path(repo), k) for k in ("brief","plan","report","test_report","review","history")}
            self._send(json.dumps({"repo": repo, "artifacts": arts}).encode())
        elif u.path == "/api/village/repos":
            self._send(json.dumps({"repos": discover_repos()}).encode())
        elif u.path == "/api/village/models":
            self._send(json.dumps({"models": list_models()}).encode())
        else:
            self.send_response(404); self.end_headers()

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8787)
    ap.add_argument("--host", default="127.0.0.1")
    a = ap.parse_args()
    print(f"Village server on http://{a.host}:{a.port}  (Hermes + OpenCode shared)", flush=True)
    ThreadingHTTPServer((a.host, a.port), Handler).serve_forever()
