// Operator-run diagnostic: prints booleans only, never configuration values.
// Importing this module does not load environment files; only direct CLI execution does.
import nextEnv from '@next/env';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function publicConfigStatus(env) {
  const raw = env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
  let valid = false;
  try {
    const url = new URL(raw);
    valid = (url.protocol === 'http:' || url.protocol === 'https:') &&
      !/\s/.test(raw) && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    // Malformed or absent URL; do not print the value or exception.
  }
  return {
    urlPresent: Boolean(raw),
    urlValid: valid,
    keyPresent: Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()),
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const frontendDir = fileURLToPath(new URL('../', import.meta.url));
  nextEnv.loadEnvConfig(frontendDir, true, { info() {}, error() {} });
  console.log(publicConfigStatus(process.env));
}
