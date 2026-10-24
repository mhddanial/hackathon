import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(frontendDir, "../../backend");
const candidates =
  process.platform === "win32"
    ? [path.join(backendDir, ".venv", "Scripts", "python.exe"), "python"]
    : [path.join(backendDir, ".venv", "bin", "python"), "python3", "python"];
const python = candidates.find(
  (candidate) => candidate === "python" || candidate === "python3" || existsSync(candidate),
);

if (!python) {
  console.error("Python was not found. Install the backend requirements and retry.");
  process.exit(1);
}

const result = spawnSync(
  python,
  [
    "-m",
    "pytest",
    "tests/test_route_visualization.py",
    "tests/test_route_oracle_parity.py",
    "tests/test_oracle_tools.py",
  ],
  { cwd: backendDir, stdio: "inherit" },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
