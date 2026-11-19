"""Unified Mega-Server launcher for NeuroLink (PBL4_Web + qEEG + Neural DB + Node-RED IoT).

Orchestrates on Windows (and POSIX):
  1. PostgreSQL 16 (:5432) — reuses running cluster or starts `npm run db:start -w server`
  2. Prisma migrations (`npx prisma migrate deploy`) & automatic seed when User count == 0
  3. Python FastAPI qEEG service (:8001) — warns gracefully if uvicorn/fastapi is missing
  4. Express API server (:4000, including direct RFC 6455 `/ws/hardware`) & Vite React UI (:5173)
  5. Node-RED v5 IoT Visual Gateway (:1880) — warns gracefully if `node-red` is not installed
  6. HTTP readiness polling across :4000/api/health, :4000/api/qeeg/health, and :5173
  7. Graceful process-tree cleanup on Ctrl+C (SIGINT / SIGTERM)
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple


ROOT_DIR = Path(__file__).resolve().parent
SERVER_DIR = ROOT_DIR / "server"
CLIENT_DIR = ROOT_DIR / "client"
QEEG_DIR = ROOT_DIR / "qeeg_service"
NODERED_DIR = ROOT_DIR / "node_red"

PG_HOST = "127.0.0.1"
PG_PORT = 5432
QEEG_PORT = 8001
API_PORT = 4000
UI_PORT = 5173
NODERED_PORT = 1880

HEALTH_URLS = {
    "api": f"http://127.0.0.1:{API_PORT}/api/health",
    "qeeg": f"http://127.0.0.1:{API_PORT}/api/qeeg/health",
    "ui": f"http://127.0.0.1:{UI_PORT}",
}


def configure_console_encoding() -> None:
    """Ensure UTF-8 stdout/stderr on Windows so Vietnamese output never raises UnicodeEncodeError."""
    for stream in (sys.stdout, sys.stderr):
        try:
            if hasattr(stream, "reconfigure"):
                stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass


def is_port_open(host: str, port: int, timeout: float = 0.6) -> bool:
    """Return True if a TCP connection succeeds on (host, port)."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def wait_for_port(
    host: str,
    port: int,
    timeout_sec: float,
    proc: Optional[subprocess.Popen[str]] = None,
) -> bool:
    """Poll TCP port until open, timeout expires, or watched process terminates."""
    deadline = time.monotonic() + timeout_sec
    while time.monotonic() < deadline:
        if is_port_open(host, port):
            return True
        if proc is not None and proc.poll() is not None:
            return False
        time.sleep(0.5)
    return is_port_open(host, port)


def http_get_json(url: str, timeout: float = 2.0) -> Tuple[int, Optional[Dict[str, object]]]:
    """Perform a lightweight GET request returning (status_code, parsed_json_or_none)."""
    req = urllib.request.Request(
        url,
        method="GET",
        headers={"Accept": "text/html,application/json,*/*"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        status = getattr(resp, "status", 200)
        raw = resp.read().decode("utf-8", errors="replace")
        try:
            data = json.loads(raw)
            return status, data if isinstance(data, dict) else None
        except json.JSONDecodeError:
            return status, None


def resolve_tool(name: str) -> str:
    """Resolve CLI executable across Windows (.cmd/.exe) and POSIX."""
    candidates = [f"{name}.cmd", f"{name}.exe", name] if os.name == "nt" else [name]
    for candidate in candidates:
        found = shutil.which(candidate)
        if found:
            return found
    raise FileNotFoundError(f"Required executable '{name}' was not found in PATH.")


def find_nodered_cli() -> Optional[str]:
    """Locate the Node-RED CLI executable across Windows (.cmd/.exe) and POSIX."""
    candidates = ["node-red.cmd", "node-red.exe", "node-red"] if os.name == "nt" else ["node-red"]
    for candidate in candidates:
        found = shutil.which(candidate)
        if found:
            return found
    return None


def find_cloudflared_cli() -> Optional[str]:
    """Locate cloudflared executable across project tools/, system PATH, and Program Files."""
    candidates = [
        ROOT_DIR / "tools" / "cloudflared.exe",
        ROOT_DIR / "tools" / "cloudflared",
        Path("C:/Program Files/cloudflared/cloudflared.exe"),
        Path("C:/Program Files (x86)/cloudflared/cloudflared.exe"),
    ]
    which_cf = shutil.which("cloudflared")
    if which_cf:
        candidates.append(Path(which_cf))
    for c in candidates:
        if c.exists():
            return str(c)
    return None


def find_qeeg_python() -> Optional[str]:
    """Locate a Python interpreter that can import uvicorn and fastapi."""
    candidates: List[Path] = [
        QEEG_DIR / ".venv" / "Scripts" / "python.exe",
        ROOT_DIR / ".venv" / "Scripts" / "python.exe",
        QEEG_DIR / ".venv" / "bin" / "python",
        ROOT_DIR / ".venv" / "bin" / "python",
        Path(sys.executable),
    ]
    which_py = shutil.which("python")
    if which_py:
        candidates.append(Path(which_py))

    seen: set[str] = set()
    for py_path in candidates:
        resolved = str(py_path)
        if resolved in seen or not py_path.exists():
            continue
        seen.add(resolved)
        try:
            probe = subprocess.run(
                [resolved, "-c", "import uvicorn, fastapi"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=8,
                check=False,
            )
            if probe.returncode == 0:
                return resolved
        except Exception:
            continue
    return None


def _stream_output(
    proc: subprocess.Popen[str],
    tag: str,
    on_line: Optional[Callable[[str], None]] = None,
) -> None:
    """Stream child stdout/stderr lines with a consistent component prefix."""
    if proc.stdout is None:
        return
    try:
        for line in proc.stdout:
            text = line.rstrip("\r\n")
            if text:
                print(f"[{tag}] {text}", flush=True)
                if on_line:
                    try:
                        on_line(text)
                    except Exception:
                        pass
    except Exception:
        pass


def spawn_managed(
    tag: str,
    cmd: List[str],
    cwd: Path,
    extra_env: Optional[Dict[str, str]] = None,
    on_line: Optional[Callable[[str], None]] = None,
) -> subprocess.Popen[str]:
    """Spawn a managed subprocess in its own process group with prefixed log streaming."""
    env = os.environ.copy()
    env.setdefault("PYTHONIOENCODING", "utf-8")
    env.setdefault("PYTHONUNBUFFERED", "1")
    env.setdefault("FORCE_COLOR", "0")
    if extra_env:
        env.update(extra_env)

    creationflags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
    proc = subprocess.Popen(
        cmd,
        cwd=str(cwd),
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
        creationflags=creationflags,
        start_new_session=(os.name != "nt"),
    )
    reader = threading.Thread(target=_stream_output, args=(proc, tag, on_line), daemon=True)
    reader.start()
    return proc


def terminate_process_tree(proc: subprocess.Popen[str], tag: str) -> None:
    """Gracefully stop a managed child process and all of its descendants."""
    if proc.poll() is not None:
        return
    print(f"[launcher] Stopping {tag} (pid={proc.pid})...", flush=True)
    try:
        if os.name == "nt":
            try:
                proc.send_signal(signal.CTRL_BREAK_EVENT)
                proc.wait(timeout=3.0)
                return
            except Exception:
                pass
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=10,
                check=False,
            )
        else:
            os.killpg(proc.pid, signal.SIGTERM)
            try:
                proc.wait(timeout=4.0)
            except subprocess.TimeoutExpired:
                os.killpg(proc.pid, signal.SIGKILL)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass


def wait_for_postgres_sql_ready(
    node_cmd: str,
    timeout_sec: float = 60.0,
    proc: Optional[subprocess.Popen[str]] = None,
) -> None:
    """Wait until PostgreSQL finishes WAL recovery and accepts SQL queries on pbl4_web."""
    script = (
        "import { existsSync } from 'node:fs'; "
        "if (existsSync('.env')) process.loadEnvFile('.env'); "
        "const { PrismaClient } = await import('@prisma/client'); "
        "const prisma = new PrismaClient(); "
        "try { "
        "await prisma.$queryRawUnsafe('SELECT 1'); "
        "console.log('PG_SQL_READY=1'); "
        "} finally { await prisma.$disconnect(); }"
    )
    deadline = time.monotonic() + timeout_sec
    last_err = ""
    while time.monotonic() < deadline:
        if proc is not None and proc.poll() is not None:
            raise RuntimeError(
                f"PostgreSQL process exited prematurely with code {proc.returncode}."
            )
        try:
            res = subprocess.run(
                [node_cmd, "--input-type=module", "-e", script],
                cwd=str(SERVER_DIR),
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=10,
                check=False,
            )
            if res.returncode == 0 and "PG_SQL_READY=1" in res.stdout:
                return
            last_err = (res.stderr or res.stdout).strip()
        except Exception as exc:
            last_err = str(exc)
        time.sleep(1.5)
    raise RuntimeError(
        f"PostgreSQL did not accept SQL queries within {timeout_sec:.0f}s. Last error: {last_err}"
    )


def run_prisma_deploy(npx_cmd: str) -> None:
    """Apply pending Prisma migrations in server/ with brief retry for startup races."""
    print("[db] Running `npx prisma migrate deploy` in server/...", flush=True)
    for attempt in range(1, 4):
        res = subprocess.run(
            [npx_cmd, "prisma", "migrate", "deploy"],
            cwd=str(SERVER_DIR),
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
        if res.returncode == 0:
            return
        if attempt < 3:
            print(
                f"[db] `prisma migrate deploy` attempt {attempt} exited {res.returncode}; retrying in 2s...",
                flush=True,
            )
            time.sleep(2.0)
    raise RuntimeError("prisma migrate deploy failed after 3 attempts.")


def query_user_count(node_cmd: str) -> int:
    """Return total rows in PostgreSQL User table using PrismaClient inside server/."""
    script = (
        "import { existsSync } from 'node:fs'; "
        "if (existsSync('.env')) process.loadEnvFile('.env'); "
        "const { PrismaClient } = await import('@prisma/client'); "
        "const prisma = new PrismaClient(); "
        "try { "
        "const count = await prisma.user.count(); "
        "console.log('USER_COUNT=' + count); "
        "} finally { await prisma.$disconnect(); }"
    )
    res = subprocess.run(
        [node_cmd, "--input-type=module", "-e", script],
        cwd=str(SERVER_DIR),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=30,
        check=False,
    )
    if res.returncode != 0:
        raise RuntimeError(
            f"Failed to query User count via Prisma (exit {res.returncode}): {res.stderr.strip()}"
        )
    match = re.search(r"USER_COUNT=(\d+)", res.stdout)
    if not match:
        raise RuntimeError(f"Unexpected User count output: {res.stdout.strip()}")
    return int(match.group(1))


def ensure_seed_on_fresh_db(npm_cmd: str, node_cmd: str, skip_seed: bool) -> None:
    """Seed demo accounts, Neural DB samples, and 4 startup pillars if User table is empty."""
    user_count = query_user_count(node_cmd)
    if user_count == 0:
        if skip_seed:
            print("[db] User table is empty (0 rows), skipped seeding due to --skip-seed.", flush=True)
            return
        print("[db] Fresh database detected (0 users). Running `npm run db:seed -w server`...", flush=True)
        res = subprocess.run(
            [npm_cmd, "run", "db:seed", "-w", "server"],
            cwd=str(ROOT_DIR),
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
        if res.returncode != 0:
            raise RuntimeError(f"npm run db:seed -w server failed with exit code {res.returncode}.")
        print("[db] Database seed completed.", flush=True)
    else:
        print(f"[db] Existing database detected ({user_count} users) — skipping auto-seed.", flush=True)


def wait_for_unified_health(
    timeout_sec: float,
    watched_procs: List[Tuple[str, subprocess.Popen[str]]],
) -> Dict[str, object]:
    """Poll Express, qEEG health, and Vite UI until all respond HTTP 200."""
    deadline = time.monotonic() + timeout_sec
    ready = {"api": False, "qeeg": False, "ui": False}
    qeeg_payload: Dict[str, object] = {}

    while time.monotonic() < deadline:
        for name, proc in watched_procs:
            if proc.poll() is not None:
                raise RuntimeError(
                    f"Managed service '{name}' exited prematurely with code {proc.returncode}."
                )

        if not ready["api"]:
            try:
                code, _ = http_get_json(HEALTH_URLS["api"], timeout=1.5)
                if code == 200:
                    ready["api"] = True
                    print(f"[ready] Express API listening -> {HEALTH_URLS['api']}", flush=True)
            except Exception:
                pass

        if not ready["qeeg"] and ready["api"]:
            try:
                code, payload = http_get_json(HEALTH_URLS["qeeg"], timeout=2.0)
                if code == 200:
                    ready["qeeg"] = True
                    qeeg_payload = payload or {}
                    engine_source = qeeg_payload.get("engineSource", "unknown")
                    print(
                        f"[ready] qEEG endpoint listening ({engine_source}) -> {HEALTH_URLS['qeeg']}",
                        flush=True,
                    )
            except Exception:
                pass

        if not ready["ui"]:
            try:
                code, _ = http_get_json(HEALTH_URLS["ui"], timeout=1.5)
                if code == 200:
                    ready["ui"] = True
                    print(f"[ready] Vite React UI listening -> {HEALTH_URLS['ui']}", flush=True)
            except Exception:
                pass

        if all(ready.values()):
            return qeeg_payload

        time.sleep(0.75)

    missing = [k for k, ok in ready.items() if not ok]
    raise TimeoutError(f"Timed out waiting for readiness of: {', '.join(missing)}")


def print_summary_banner(
    qeeg_payload: Dict[str, object],
    python_qeeg_active: bool,
    nodered_active: bool = False,
    tunnel_url: Optional[str] = None,
    tunnel_enabled: bool = True,
) -> None:
    """Print URLs, engine routing status, public tunnel, and seeded demo account credentials."""
    engine_source = qeeg_payload.get("engineSource", "ts_dsp_fallback")
    categories = qeeg_payload.get(
        "categories",
        ["VASCULAR_STROKE", "EPILEPSY_ICU", "SLEEP_COGNITIVE", "HARDWARE_BCI"],
    )
    print("\n" + "=" * 72)
    print("  NEUROLINK UNIFIED MEGA-SERVER IS ONLINE")
    print("=" * 72)
    print(f"  Web Application (UI)    : http://127.0.0.1:{UI_PORT}")
    if tunnel_url:
        print(f"  Public Web Access       : {tunnel_url}  <-- LINK CHO BAN BE")
    elif tunnel_enabled:
        print("  Public Web Access       : DANG TAO DUONG DAN... (Kiem tra log [tunnel])")
    else:
        print("  Public Web Access       : DA TAT (--no-share)")
    print(f"  Clinical Workstation    : http://127.0.0.1:{UI_PORT}/clinical-workstation")
    print(f"  Express API Health      : http://127.0.0.1:{API_PORT}/api/health")
    print(f"  Hardware Direct WS      : ws://127.0.0.1:{API_PORT}/ws/hardware")
    if nodered_active:
        print(f"  Node-RED IoT Gateway    : http://127.0.0.1:{NODERED_PORT}")
    else:
        print(f"  Node-RED IoT Gateway    : NOT RUNNING (http://127.0.0.1:{NODERED_PORT})")
    print(f"  qEEG Gateway Health     : http://127.0.0.1:{API_PORT}/api/qeeg/health ({engine_source})")
    if python_qeeg_active:
        print(f"  Python qEEG Service     : http://127.0.0.1:{QEEG_PORT}/api/qeeg/health")
    else:
        print("  Python qEEG Service     : NOT RUNNING (served via Express TS DSP fallback)")
    print(f"  Clinical Categories     : {', '.join(str(c) for c in categories)}")
    print("-" * 72)
    print("  DEMO ACCOUNTS (Password for all: Password123)")
    print("    - admin            : Ban Quan tri NeuroLink (Admin / Review Board)")
    print("    - dr_minh          : BS. CKII Nguyen Van Minh (Verified Neurologist)")
    print("    - prof_lan         : PGS. TS. Tran Mai Lan (Verified BCI Researcher)")
    print("    - bs_noitru_khang  : BS. Noi tru Pham Minh Khang (Verified Resident Triage)")
    print("    - hoa_health       : Le Thi Hoa (General User / Self-Service EEG)")
    print("=" * 72)
    print("  Press Ctrl+C to shut down all managed processes cleanly.\n", flush=True)


def run_preflight(node_cmd: str) -> int:
    """Inspect environment, PostgreSQL port, User count, Python uvicorn, and Node-RED readiness."""
    pg_open = is_port_open(PG_HOST, PG_PORT)
    py_exe = find_qeeg_python()
    nodered_cli = find_nodered_cli()
    cf_cli = find_cloudflared_cli()
    nodered_open = is_port_open("127.0.0.1", NODERED_PORT)
    print(f"[preflight] Root dir        : {ROOT_DIR}")
    print(f"[preflight] server/.env     : {(SERVER_DIR / '.env').exists()}")
    print(f"[preflight] Postgres :5432  : {'OPEN' if pg_open else 'CLOSED'}")
    if pg_open:
        try:
            users = query_user_count(node_cmd)
            print(f"[preflight] User count      : {users}")
        except Exception as exc:
            print(f"[preflight] User count err  : {exc}")
    print(f"[preflight] Python qEEG env : {py_exe or 'NOT AVAILABLE (TS DSP fallback ready)'}")
    print(
        f"[preflight] Node-RED CLI    : {nodered_cli or 'NOT INSTALLED (direct WS :4000 still available)'}"
    )
    print(
        f"[preflight] Node-RED :1880  : {'OPEN' if nodered_open else 'CLOSED'} "
        f"(flows={'OK' if (NODERED_DIR / 'flows.json').exists() else 'MISSING'})"
    )
    print(
        f"[preflight] Cloudflare Tun  : {cf_cli or 'NOT FOUND (localtunnel fallback ready)'}"
    )
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Launch the unified NeuroLink Mega-Server "
            "(PostgreSQL + FastAPI qEEG + Express + Node-RED IoT + Vite + Cloudflare Tunnel)."
        )
    )
    parser.add_argument("--skip-seed", action="store_true", help="Do not auto-seed if User count is 0.")
    parser.add_argument("--no-qeeg", action="store_true", help="Skip Python qEEG service and force TS fallback.")
    parser.add_argument(
        "--no-nodered",
        action="store_true",
        help="Skip Node-RED IoT Visual Gateway (:1880); direct Express WS (:4000) stays active.",
    )
    parser.add_argument(
        "--no-share",
        action="store_true",
        help="Disable public Cloudflare/localtunnel sharing (enabled by default).",
    )
    parser.add_argument(
        "--preflight",
        action="store_true",
        help="Check ports, Prisma DB user count, Python uvicorn, and Node-RED availability without starting servers.",
    )
    return parser.parse_args()


def main() -> int:
    configure_console_encoding()
    args = parse_args()

    npm_cmd = resolve_tool("npm")
    npx_cmd = resolve_tool("npx")
    node_cmd = resolve_tool("node")

    if args.preflight:
        return run_preflight(node_cmd)

    if not (SERVER_DIR / ".env").exists():
        print(
            f"[WARN] Missing {SERVER_DIR / '.env'}. Copy server/.env.example to server/.env before production use.",
            flush=True,
        )

    managed_procs: List[Tuple[str, subprocess.Popen[str]]] = []
    stop_event = threading.Event()

    def _signal_handler(_signum: int, _frame: object) -> None:
        stop_event.set()

    signal.signal(signal.SIGINT, _signal_handler)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, _signal_handler)

    try:
        # (a) PostgreSQL 16 on :5432
        db_proc: Optional[subprocess.Popen[str]] = None
        if is_port_open(PG_HOST, PG_PORT):
            print(f"[db] PostgreSQL 16 already listening on {PG_HOST}:{PG_PORT} — reusing running cluster.", flush=True)
        else:
            print(f"[db] Port {PG_PORT} is not listening. Starting PostgreSQL via `npm run db:start -w server`...", flush=True)
            db_proc = spawn_managed("db", [npm_cmd, "run", "db:start", "-w", "server"], ROOT_DIR)
            managed_procs.append(("db", db_proc))
            if not wait_for_port(PG_HOST, PG_PORT, timeout_sec=60.0, proc=db_proc):
                raise RuntimeError("PostgreSQL failed to become ready on 127.0.0.1:5432 within 60s.")
            print(f"[db] PostgreSQL 16 port {PG_PORT} open; waiting for WAL recovery & SQL readiness...", flush=True)

        wait_for_postgres_sql_ready(node_cmd, timeout_sec=60.0, proc=db_proc)
        print(f"[db] PostgreSQL 16 SQL ready on {PG_HOST}:{PG_PORT}.", flush=True)

        # (b) Prisma migrations & auto-seed on fresh DB
        run_prisma_deploy(npx_cmd)
        ensure_seed_on_fresh_db(npm_cmd, node_cmd, skip_seed=args.skip_seed)

        # (c) Python FastAPI qEEG service on :8001 (graceful fallback to Express TS engine)
        python_qeeg_active = False
        if is_port_open("127.0.0.1", QEEG_PORT):
            print(f"[qeeg] Existing qEEG service detected on 127.0.0.1:{QEEG_PORT}.", flush=True)
            python_qeeg_active = True
        elif args.no_qeeg:
            print("[qeeg] --no-qeeg enabled; Express TS DSP fallback will serve /api/qeeg/*.", flush=True)
        else:
            qeeg_python = find_qeeg_python()
            if qeeg_python is None:
                print(
                    "[WARN] Python 'uvicorn'/'fastapi' is not installed in the active environment.\n"
                    "[WARN] Continuing without Python :8001 — Express TypeScript DSP fallback will serve /api/qeeg/* seamlessly.",
                    flush=True,
                )
            else:
                print(f"[qeeg] Starting FastAPI qEEG service on 127.0.0.1:{QEEG_PORT}...", flush=True)
                qeeg_proc = spawn_managed(
                    "qeeg",
                    [qeeg_python, "-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", str(QEEG_PORT)],
                    QEEG_DIR,
                    extra_env={"QEEG_PORT": str(QEEG_PORT)},
                )
                managed_procs.append(("qeeg", qeeg_proc))
                # Warm wait so Express sees Python qEEG immediately if healthy
                warm_deadline = time.monotonic() + 15.0
                while time.monotonic() < warm_deadline and not stop_event.is_set():
                    if qeeg_proc.poll() is not None:
                        print(
                            f"[WARN] Python qEEG exited (code {qeeg_proc.returncode}); Express TS DSP fallback will handle /api/qeeg/*.",
                            flush=True,
                        )
                        break
                    try:
                        code, _ = http_get_json(f"http://127.0.0.1:{QEEG_PORT}/api/qeeg/health", timeout=1.0)
                        if code == 200:
                            python_qeeg_active = True
                            break
                    except Exception:
                        pass
                    time.sleep(0.5)

        # (d) Express API (:4000) and Vite React UI (:5173)
        watched_critical: List[Tuple[str, subprocess.Popen[str]]] = []
        if is_port_open("127.0.0.1", API_PORT):
            print(f"[WARN] Port {API_PORT} is already listening; skipping Express launch.", flush=True)
        else:
            print(f"[api] Starting Express API server on 127.0.0.1:{API_PORT}...", flush=True)
            api_proc = spawn_managed("api", [npm_cmd, "run", "dev", "-w", "server"], ROOT_DIR)
            managed_procs.append(("api", api_proc))
            watched_critical.append(("api", api_proc))

        if is_port_open("127.0.0.1", UI_PORT):
            print(f"[WARN] Port {UI_PORT} is already listening; skipping Vite UI launch.", flush=True)
        else:
            print(f"[ui] Starting Vite React UI on 127.0.0.1:{UI_PORT}...", flush=True)
            vite_bin = ROOT_DIR / "node_modules" / "vite" / "bin" / "vite.js"
            if vite_bin.exists():
                ui_proc = spawn_managed("ui", [node_cmd, str(vite_bin)], CLIENT_DIR)
            else:
                ui_proc = spawn_managed("ui", [npm_cmd, "run", "dev", "-w", "client"], ROOT_DIR)
            managed_procs.append(("ui", ui_proc))
            watched_critical.append(("ui", ui_proc))

        # (e) Node-RED IoT Visual Gateway on :1880 (optional; graceful warning if missing)
        nodered_active = False
        if is_port_open("127.0.0.1", NODERED_PORT):
            print(
                f"[node-red] Existing Node-RED gateway detected on 127.0.0.1:{NODERED_PORT}.",
                flush=True,
            )
            nodered_active = True
        elif args.no_nodered:
            print(
                "[node-red] --no-nodered enabled; direct Express WS (/ws/hardware on :4000) remains active.",
                flush=True,
            )
        else:
            nodered_cli = find_nodered_cli()
            nodered_settings = NODERED_DIR / "settings.js"
            if nodered_cli is None:
                print(
                    "[WARN] 'node-red' CLI was not found in PATH — skipping Node-RED IoT Gateway (:1880).\n"
                    "[WARN] Install globally with `npm i -g node-red` or connect ESP32 directly to ws://127.0.0.1:4000/ws/hardware.",
                    flush=True,
                )
            elif not nodered_settings.exists():
                print(
                    f"[WARN] Missing {nodered_settings}; skipping Node-RED IoT Gateway (:1880).",
                    flush=True,
                )
            else:
                print(
                    f"[node-red] Starting Node-RED IoT Gateway on 127.0.0.1:{NODERED_PORT}...",
                    flush=True,
                )
                nodered_proc = spawn_managed(
                    "node-red",
                    [
                        nodered_cli,
                        "-u",
                        str(NODERED_DIR),
                        "-s",
                        str(nodered_settings),
                        "--no-telemetry",
                    ],
                    ROOT_DIR,
                    extra_env={
                        "NODERED_PORT": str(NODERED_PORT),
                        "NEUROLINK_API_URL": f"http://127.0.0.1:{API_PORT}",
                    },
                )
                managed_procs.append(("node-red", nodered_proc))
                nr_deadline = time.monotonic() + 12.0
                while time.monotonic() < nr_deadline and not stop_event.is_set():
                    if nodered_proc.poll() is not None:
                        print(
                            f"[WARN] Node-RED exited (code {nodered_proc.returncode}); continuing with direct Express WS (:4000).",
                            flush=True,
                        )
                        break
                    try:
                        code, _ = http_get_json(
                            f"http://127.0.0.1:{NODERED_PORT}/gateway/status",
                            timeout=1.0,
                        )
                        if code == 200:
                            nodered_active = True
                            print(
                                f"[ready] Node-RED IoT Gateway listening -> http://127.0.0.1:{NODERED_PORT}",
                                flush=True,
                            )
                            break
                    except Exception:
                        pass
                    time.sleep(0.5)
                if not nodered_active and nodered_proc.poll() is None:
                    nodered_active = is_port_open("127.0.0.1", NODERED_PORT)

        # (f) Public Share Tunnel (Cloudflare Tunnel or localtunnel)
        tunnel_urls: List[str] = []
        if not args.no_share:
            cf_cli = find_cloudflared_cli()

            def _on_tunnel_line(line: str) -> None:
                m_cf = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", line)
                if m_cf and not tunnel_urls:
                    url = m_cf.group(0)
                    tunnel_urls.append(url)
                    print(
                        f"\n{'=' * 72}\n"
                        f"  >>> LINK PUBLIC INTERNET CHO BAN BE: {url} <<<\n"
                        f"{'=' * 72}\n",
                        flush=True,
                    )
                m_lt = re.search(r"https://[a-zA-Z0-9-]+\.loca\.lt", line)
                if m_lt and not tunnel_urls:
                    url = m_lt.group(0)
                    tunnel_urls.append(url)
                    print(
                        f"\n{'=' * 72}\n"
                        f"  >>> LINK PUBLIC INTERNET CHO BAN BE: {url} <<<\n"
                        f"{'=' * 72}\n",
                        flush=True,
                    )

            if cf_cli:
                print(
                    f"[tunnel] Starting Cloudflare Public Tunnel -> 127.0.0.1:{UI_PORT}...",
                    flush=True,
                )
                tunnel_proc = spawn_managed(
                    "tunnel",
                    [cf_cli, "tunnel", "--url", f"http://127.0.0.1:{UI_PORT}", "--no-autoupdate"],
                    ROOT_DIR,
                    on_line=_on_tunnel_line,
                )
                managed_procs.append(("tunnel", tunnel_proc))
            else:
                print(
                    f"[tunnel] Cloudflare binary not found; starting localtunnel -> 127.0.0.1:{UI_PORT}...",
                    flush=True,
                )
                tunnel_proc = spawn_managed(
                    "tunnel",
                    [npx_cmd, "--yes", "localtunnel", "--port", str(UI_PORT), "--subdomain", "neurolink-eeg"],
                    ROOT_DIR,
                    on_line=_on_tunnel_line,
                )
                managed_procs.append(("tunnel", tunnel_proc))

        # (g) Poll unified endpoints and print banner
        qeeg_payload = wait_for_unified_health(timeout_sec=60.0, watched_procs=watched_critical)

        # Brief wait if tunnel url is still registering with edge
        if not args.no_share and not tunnel_urls:
            t_wait_deadline = time.monotonic() + 4.0
            while time.monotonic() < t_wait_deadline and not tunnel_urls and not stop_event.is_set():
                time.sleep(0.5)

        active_tunnel_url = tunnel_urls[0] if tunnel_urls else None
        print_summary_banner(
            qeeg_payload,
            python_qeeg_active=python_qeeg_active,
            nodered_active=nodered_active,
            tunnel_url=active_tunnel_url,
            tunnel_enabled=not args.no_share,
        )

        while not stop_event.is_set():
            for name, proc in watched_critical:
                if proc.poll() is not None:
                    print(f"[ERROR] Critical service '{name}' exited with code {proc.returncode}.", flush=True)
                    stop_event.set()
                    return 1
            stop_event.wait(0.5)

        return 0
    except KeyboardInterrupt:
        return 0
    except Exception as exc:
        print(f"\n[ERROR] Unified launcher failed: {exc}", file=sys.stderr, flush=True)
        return 1
    finally:
        if managed_procs:
            print("\n[launcher] Shutting down managed processes...", flush=True)
            for tag, proc in reversed(managed_procs):
                terminate_process_tree(proc, tag)
            print("[launcher] All managed processes stopped.", flush=True)


if __name__ == "__main__":
    sys.exit(main())
