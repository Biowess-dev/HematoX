#!/usr/bin/env python3
"""
HematoX — Cross-platform launcher
Starts the FastAPI backend and Vite frontend, then opens the browser.
Requires: Python 3.10+, Node.js 18+, npm 9+
Install launcher dependency first: pip install rich
"""

import os
import platform
import shutil
import signal
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

# ---------------------------------------------------------------------------
# Bootstrap: ensure 'rich' is available before anything else
# ---------------------------------------------------------------------------
try:
    from rich import print as rprint
    from rich.align import Align
    from rich.columns import Columns
    from rich.console import Console
    from rich.panel import Panel
    from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TimeElapsedColumn
    from rich.rule import Rule
    from rich.style import Style
    from rich.table import Table
    from rich.text import Text
    import rich.box as box
except ImportError:
    print("Installing 'rich' for a better terminal experience...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "rich", "--quiet"])
    from rich import print as rprint
    from rich.align import Align
    from rich.columns import Columns
    from rich.console import Console
    from rich.panel import Panel
    from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TimeElapsedColumn
    from rich.rule import Rule
    from rich.style import Style
    from rich.table import Table
    from rich.text import Text
    import rich.box as box

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CONSOLE = Console()
ROOT = Path(__file__).parent.resolve()
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"
ENV_FILE = ROOT / ".env"
ENV_EXAMPLE = ROOT / ".env.example"
REQUIREMENTS = ROOT / "requirements.txt"
BACKEND_URL = "http://localhost:8000/health"
FRONTEND_URL = "http://localhost:5173"
BACKEND_PORT = 8000
FRONTEND_PORT = 5173

OS = platform.system()          # "Windows", "Linux", "Darwin"
PYTHON = sys.executable

# ---------------------------------------------------------------------------
# ANSI / Rich helpers
# ---------------------------------------------------------------------------
def header():
    """Print the HematoX ASCII banner."""
    CONSOLE.print()
    banner = Text()
    banner.append("  ██╗  ██╗███████╗███╗   ███╗ █████╗ ████████╗ ██████╗ ██╗  ██╗\n", style="bold red")
    banner.append("  ██║  ██║██╔════╝████╗ ████║██╔══██╗╚══██╔══╝██╔═══██╗╚██╗██╔╝\n", style="bold red")
    banner.append("  ███████║█████╗  ██╔████╔██║███████║   ██║   ██║   ██║ ╚███╔╝ \n", style="bold bright_red")
    banner.append("  ██╔══██║██╔══╝  ██║╚██╔╝██║██╔══██║   ██║   ██║   ██║ ██╔██╗ \n", style="bold bright_red")
    banner.append("  ██║  ██║███████╗██║ ╚═╝ ██║██║  ██║   ██║   ╚██████╔╝██╔╝ ██╗\n", style="bold red")
    banner.append("  ╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝", style="bold red")

    subtitle = Text("  Hematology Reasoning Engine  ·  Local-First  ·  Educational Use Only", style="dim white")

    CONSOLE.print(Panel(
        Align.center(banner),
        border_style="red",
        padding=(0, 2),
    ))
    CONSOLE.print(Align.center(subtitle))
    CONSOLE.print()


def section(title: str):
    CONSOLE.print(Rule(f"[bold white]{title}[/bold white]", style="dim red"))


def ok(msg: str):
    CONSOLE.print(f"  [bold green]✓[/bold green]  {msg}")


def warn(msg: str):
    CONSOLE.print(f"  [bold yellow]⚠[/bold yellow]  {msg}")


def error(msg: str):
    CONSOLE.print(f"  [bold red]✗[/bold red]  {msg}")


def info(msg: str):
    CONSOLE.print(f"  [dim]→[/dim]  {msg}")


def fatal(msg: str):
    CONSOLE.print()
    CONSOLE.print(Panel(f"[bold red]{msg}[/bold red]", title="[red]Fatal Error[/red]", border_style="red"))
    sys.exit(1)


# ---------------------------------------------------------------------------
# System checks
# ---------------------------------------------------------------------------
def check_python_version():
    section("Python")
    major, minor = sys.version_info[:2]
    if major < 3 or (major == 3 and minor < 10):
        fatal(f"Python 3.10+ is required. You have {major}.{minor}.\nDownload: https://python.org/downloads")
    ok(f"Python {major}.{minor} detected ({PYTHON})")


def check_node():
    section("Node.js & npm")
    node = shutil.which("node")
    npm = shutil.which("npm")

    if not node:
        fatal(
            "Node.js not found.\n"
            "Install from: https://nodejs.org/\n"
            "Recommended: Node.js 20 LTS"
        )

    result = subprocess.run(["node", "--version"], capture_output=True, text=True)
    version_str = result.stdout.strip().lstrip("v")
    try:
        node_major = int(version_str.split(".")[0])
        if node_major < 18:
            fatal(f"Node.js 18+ required. You have v{version_str}.\nUpgrade: https://nodejs.org/")
        ok(f"Node.js v{version_str} detected")
    except ValueError:
        warn(f"Could not parse Node.js version: {version_str}")

    if not npm:
        fatal("npm not found. It should come with Node.js. Reinstall Node.js from https://nodejs.org/")

    result = subprocess.run(["npm", "--version"], capture_output=True, text=True)
    ok(f"npm v{result.stdout.strip()} detected")


def check_os():
    section("System")
    ok(f"Operating system: {OS} ({platform.release()})")
    ok(f"Architecture: {platform.machine()}")
    ok(f"Project root: {ROOT}")


# ---------------------------------------------------------------------------
# Environment / .env setup
# ---------------------------------------------------------------------------
def ensure_env():
    section("Environment")
    if not ENV_FILE.exists():
        if ENV_EXAMPLE.exists():
            shutil.copy(ENV_EXAMPLE, ENV_FILE)
            warn(".env not found — created from .env.example")
            info("Open .env and add your GEMINI_API_KEY, or set it later in the app Settings page.")
        else:
            ENV_FILE.write_text("GEMINI_API_KEY=\n")
            warn(".env created (empty). Add your GEMINI_API_KEY to use AI features.")
    else:
        content = ENV_FILE.read_text()
        if "GEMINI_API_KEY=" in content:
            key_line = [l for l in content.splitlines() if l.startswith("GEMINI_API_KEY=")]
            key_value = key_line[0].split("=", 1)[1].strip() if key_line else ""
            if key_value and not key_value.startswith("#"):
                ok("GEMINI_API_KEY is configured in .env")
            else:
                warn("GEMINI_API_KEY is empty in .env — set it in the app Settings page after launch.")
        else:
            warn("GEMINI_API_KEY not found in .env — set it in the app Settings page after launch.")


# ---------------------------------------------------------------------------
# Dependency installation
# ---------------------------------------------------------------------------
def is_first_run_backend() -> bool:
    """Heuristic: check if fastapi is importable."""
    result = subprocess.run(
        [PYTHON, "-c", "import fastapi, uvicorn, aiosqlite"],
        capture_output=True
    )
    return result.returncode != 0


def is_first_run_frontend() -> bool:
    return not (FRONTEND_DIR / "node_modules").exists()


def install_backend_deps():
    section("Backend Dependencies")
    if not REQUIREMENTS.exists():
        fatal(f"requirements.txt not found at {REQUIREMENTS}")

    if not is_first_run_backend():
        ok("Backend dependencies already installed — skipping")
        return

    info("Installing Python packages from requirements.txt...")
    CONSOLE.print()

    with Progress(
        SpinnerColumn(style="red"),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(bar_width=40, style="red"),
        TimeElapsedColumn(),
        console=CONSOLE,
        transient=True,
    ) as progress:
        task = progress.add_task("Installing backend dependencies...", total=None)
        result = subprocess.run(
            [PYTHON, "-m", "pip", "install", "-r", str(REQUIREMENTS), "--quiet"],
            capture_output=True,
            text=True,
            cwd=ROOT,
        )
        progress.update(task, completed=True)

    if result.returncode != 0:
        CONSOLE.print(result.stderr)
        fatal("pip install failed. Check the error above.")

    ok("Backend dependencies installed successfully")


def install_frontend_deps():
    section("Frontend Dependencies")
    if not FRONTEND_DIR.exists():
        fatal(f"frontend/ directory not found at {FRONTEND_DIR}")

    if not is_first_run_frontend():
        ok("node_modules already present — skipping npm install")
        return

    info("Running npm install in frontend/...")
    CONSOLE.print()

    with Progress(
        SpinnerColumn(style="red"),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(bar_width=40, style="red"),
        TimeElapsedColumn(),
        console=CONSOLE,
        transient=True,
    ) as progress:
        task = progress.add_task("Installing frontend dependencies...", total=None)
        result = subprocess.run(
            ["npm", "install", "--silent"],
            capture_output=True,
            text=True,
            cwd=FRONTEND_DIR,
        )
        progress.update(task, completed=True)

    if result.returncode != 0:
        CONSOLE.print(result.stderr)
        fatal("npm install failed. Check the error above.")

    ok("Frontend dependencies installed successfully")


# ---------------------------------------------------------------------------
# Port check
# ---------------------------------------------------------------------------
def port_in_use(port: int) -> bool:
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        return s.connect_ex(("127.0.0.1", port)) == 0


def check_ports():
    section("Port Check")
    if port_in_use(BACKEND_PORT):
        warn(f"Port {BACKEND_PORT} is already in use — backend may already be running")
    else:
        ok(f"Port {BACKEND_PORT} is free (backend)")

    if port_in_use(FRONTEND_PORT):
        warn(f"Port {FRONTEND_PORT} is already in use — frontend may already be running")
    else:
        ok(f"Port {FRONTEND_PORT} is free (frontend)")


# ---------------------------------------------------------------------------
# Service startup
# ---------------------------------------------------------------------------
def start_backend() -> subprocess.Popen:
    section("Starting Backend")
    info(f"Launching FastAPI on http://localhost:{BACKEND_PORT} ...")

    env = {**os.environ}
    # Load .env manually so the subprocess picks it up
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()

    kwargs = dict(
        cwd=ROOT,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )

    if OS == "Windows":
        proc = subprocess.Popen(
            [PYTHON, "-m", "uvicorn", "backend.main:app", "--port", str(BACKEND_PORT)],
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
            **kwargs,
        )
    else:
        proc = subprocess.Popen(
            [PYTHON, "-m", "uvicorn", "backend.main:app", "--port", str(BACKEND_PORT)],
            **kwargs,
        )

    ok(f"Backend process started (PID {proc.pid})")
    return proc


def start_frontend() -> subprocess.Popen:
    section("Starting Frontend")
    info(f"Launching Vite dev server on http://localhost:{FRONTEND_PORT} ...")

    kwargs = dict(
        cwd=FRONTEND_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )

    if OS == "Windows":
        proc = subprocess.Popen(
            ["npm", "run", "dev"],
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
            **kwargs,
        )
    else:
        proc = subprocess.Popen(["npm", "run", "dev"], **kwargs)

    ok(f"Frontend process started (PID {proc.pid})")
    return proc


# ---------------------------------------------------------------------------
# Health waiting
# ---------------------------------------------------------------------------
def wait_for_service(url: str, name: str, timeout: int = 45) -> bool:
    """Poll url until it returns HTTP 200 or timeout."""
    try:
        import urllib.request
        import urllib.error
    except ImportError:
        return True  # fallback: assume ok

    deadline = time.time() + timeout
    dots = 0

    with Progress(
        SpinnerColumn(spinner_name="dots", style="red"),
        TextColumn(f"[dim]Waiting for {name} to be ready...[/dim]"),
        TimeElapsedColumn(),
        console=CONSOLE,
        transient=True,
    ) as progress:
        task = progress.add_task(f"Waiting for {name}", total=None)
        while time.time() < deadline:
            try:
                urllib.request.urlopen(url, timeout=2)
                progress.update(task, completed=True)
                return True
            except Exception:
                time.sleep(0.8)
                dots += 1

    return False


# ---------------------------------------------------------------------------
# Graceful shutdown
# ---------------------------------------------------------------------------
_procs: list[subprocess.Popen] = []


def shutdown(signum=None, frame=None):
    CONSOLE.print()
    CONSOLE.print(Rule("[dim]Shutting down HematoX[/dim]", style="dim red"))

    for proc in _procs:
        if proc.poll() is None:
            info(f"Terminating process {proc.pid}...")
            if OS == "Windows":
                proc.send_signal(signal.CTRL_BREAK_EVENT)
            else:
                proc.terminate()
            try:
                proc.wait(timeout=5)
                ok(f"Process {proc.pid} stopped")
            except subprocess.TimeoutExpired:
                proc.kill()
                warn(f"Process {proc.pid} force-killed")

    CONSOLE.print()
    CONSOLE.print(Panel(
        "[dim white]HematoX stopped. Thank you for using HematoX.[/dim white]",
        border_style="dim red",
        padding=(0, 2),
    ))
    sys.exit(0)


# ---------------------------------------------------------------------------
# Status table
# ---------------------------------------------------------------------------
def show_status_table():
    table = Table(
        box=box.ROUNDED,
        border_style="dim red",
        header_style="bold white",
        show_header=True,
        padding=(0, 1),
    )
    table.add_column("Service", style="bold")
    table.add_column("URL", style="cyan")
    table.add_column("Status", justify="center")

    table.add_row("Backend (FastAPI)", f"http://localhost:{BACKEND_PORT}", "[bold green]● RUNNING[/bold green]")
    table.add_row("Frontend (Vite)", f"http://localhost:{FRONTEND_PORT}", "[bold green]● RUNNING[/bold green]")
    table.add_row("API Docs (Swagger)", f"http://localhost:{BACKEND_PORT}/docs", "[dim]● available[/dim]")

    CONSOLE.print()
    CONSOLE.print(Align.center(table))
    CONSOLE.print()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    header()

    # Register signal handlers early
    signal.signal(signal.SIGINT, shutdown)
    if OS != "Windows":
        signal.signal(signal.SIGTERM, shutdown)

    # --- System checks ---
    check_os()
    check_python_version()
    check_node()
    ensure_env()
    check_ports()

    # --- Install dependencies ---
    install_backend_deps()
    install_frontend_deps()

    # --- Start services ---
    backend_proc = start_backend()
    _procs.append(backend_proc)

    # Small delay before starting frontend (gives backend a head start)
    time.sleep(1.5)

    frontend_proc = start_frontend()
    _procs.append(frontend_proc)

    # --- Wait for readiness ---
    section("Waiting for Services")
    backend_ready = wait_for_service(BACKEND_URL, "Backend", timeout=45)
    if backend_ready:
        ok("Backend is ready")
    else:
        warn("Backend health check timed out — it may still be starting")

    frontend_ready = wait_for_service(FRONTEND_URL, "Frontend", timeout=45)
    if frontend_ready:
        ok("Frontend is ready")
    else:
        warn("Frontend health check timed out — it may still be starting")

    # --- Show status ---
    section("HematoX is Running")
    show_status_table()

    # --- Open browser ---
    info("Opening browser...")
    try:
        webbrowser.open(FRONTEND_URL)
        ok(f"Browser opened → {FRONTEND_URL}")
    except Exception:
        warn(f"Could not open browser automatically. Visit: {FRONTEND_URL}")

    # --- Keep alive ---
    CONSOLE.print()
    CONSOLE.print(Panel(
        "[dim white]HematoX is running. Press [bold white]Ctrl+C[/bold white] to stop all services.[/dim white]",
        border_style="dim red",
        padding=(0, 2),
    ))
    CONSOLE.print()

    # Stream backend logs to terminal
    info("Streaming backend logs (Ctrl+C to stop)...")
    CONSOLE.print(Rule(style="dim"))
    CONSOLE.print()

    try:
        while True:
            # Check if processes are still alive
            if backend_proc.poll() is not None:
                error("Backend process exited unexpectedly!")
                code = backend_proc.returncode
                output = backend_proc.stdout.read().decode(errors="replace") if backend_proc.stdout else ""
                if output:
                    CONSOLE.print(Panel(output[-3000:], title="[red]Backend output[/red]", border_style="red"))
                fatal(f"Backend exited with code {code}. Check the output above.")

            if frontend_proc.poll() is not None:
                error("Frontend process exited unexpectedly!")
                code = frontend_proc.returncode
                output = frontend_proc.stdout.read().decode(errors="replace") if frontend_proc.stdout else ""
                if output:
                    CONSOLE.print(Panel(output[-2000:], title="[red]Frontend output[/red]", border_style="red"))
                fatal(f"Frontend exited with code {code}. Check the output above.")

            # Print any pending backend log output
            if backend_proc.stdout:
                import select
                readable = []
                if OS != "Windows":
                    try:
                        readable, _, _ = select.select([backend_proc.stdout], [], [], 0.3)
                    except Exception:
                        pass
                if readable or OS == "Windows":
                    try:
                        line = backend_proc.stdout.readline()
                        if line:
                            text = line.decode(errors="replace").rstrip()
                            CONSOLE.print(f"  [dim red]backend[/dim red] {text}")
                    except Exception:
                        pass

            time.sleep(0.1)

    except KeyboardInterrupt:
        shutdown()


if __name__ == "__main__":
    main()
