"""Report versions and configuration presence without dotenv or application imports."""
import importlib.metadata as metadata
import json
import os
import platform
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[4]
PACKAGES = (
    "pytest", "fastapi", "pydantic", "numpy", "pandas", "scikit-learn", "joblib",
    "supabase", "requests", "httpx", "python-dotenv", "google-genai", "uvicorn",
)
installed = {dist.metadata["Name"].lower(): dist.version for dist in metadata.distributions()}
tools = {}
for name in ("node", "npm"):
    executable = shutil.which(name)
    tools[name] = {
        "executable": executable,
        "version": subprocess.run([executable, "--version"], capture_output=True, text=True,
                                  timeout=20, check=True).stdout.strip() if executable else None,
    }
report = {
    "captured_at": datetime.now(ZoneInfo("Asia/Jakarta")).isoformat(),
    "cwd": str(Path.cwd().relative_to(ROOT)) or ".",
    "python_version": platform.python_version(),
    "python_executable": sys.executable,
    "platform": f"{platform.system()} {platform.machine()}",
    "installed_packages": {name: installed.get(name) for name in PACKAGES},
    "tools": tools,
    "inherited_configuration_present": {name: bool(os.environ.get(name)) for name in (
        "SUPABASE_URL", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_API_URL",
    )},
    "local_dependency_directories_present": {name: (ROOT / name).is_dir() for name in (
        ".venv", "backend/.venv", "backend/venv", "frontend/node_modules",
    )},
    "dotenv_files_read": False,
}
print(json.dumps(report, indent=2))
