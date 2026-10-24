// Isolate Next from all repository .env files; use only loopback synthetic services.
import { cp, mkdir, mkdtemp, symlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, basename } from "node:path";
const source = fileURLToPath(new URL("../", import.meta.url));
const root = await mkdtemp("/private/tmp/departure-sprint5-");
await cp(source, join(root, "frontend"), { recursive: true, filter: path => !["node_modules", ".next", "output"].includes(basename(path)) && !basename(path).startsWith(".env") && !path.endsWith(".tsbuildinfo") });
await symlink(join(source, "node_modules"), join(root, "frontend/node_modules"), "dir");
await mkdir(join(root, "backend/data"), { recursive: true });
await cp(new URL("../../backend/data/batam-locations.json", import.meta.url), join(root, "backend/data/batam-locations.json"));
console.log(root);
