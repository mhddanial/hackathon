// Operator-run diagnostic: never prints configuration values or raw errors.
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

// Optional, unauthenticated GET: tests Node connectivity only, not browser CORS or login.
export async function authReachability(env, fetcher = fetch) {
  if (!publicConfigStatus(env).urlValid) {
    return { checked: false, httpResponded: false, httpStatus: null, failure: 'INVALID_URL' };
  }
  try {
    const response = await fetcher(new URL('/auth/v1/health', env.NEXT_PUBLIC_SUPABASE_URL.trim()), {
      method: 'GET', redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(5000),
    });
    // Discard the body rather than inspecting or printing remote configuration.
    await response.body?.cancel().catch(() => {});
    return { checked: true, httpResponded: true, httpStatus: response.status, failure: null };
  } catch (error) {
    const code = error?.cause?.code ?? error?.code;
    let failure = 'NETWORK_OR_REDIRECT_ERROR';
    if (['ENOTFOUND', 'EAI_AGAIN'].includes(code)) failure = 'DNS_ERROR';
    else if (code === 'ECONNREFUSED') failure = 'CONNECTION_REFUSED';
    else if (['ENETUNREACH', 'EHOSTUNREACH', 'ECONNRESET', 'UND_ERR_SOCKET'].includes(code)) failure = 'CONNECTION_ERROR';
    else if (['UND_ERR_CONNECT_TIMEOUT', 'ETIMEDOUT'].includes(code) || ['TimeoutError', 'AbortError'].includes(error?.name)) failure = 'TIMEOUT';
    else if (['ERR_TLS_CERT_ALTNAME_INVALID', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'].includes(code)) failure = 'TLS_ERROR';
    return { checked: true, httpResponded: false, httpStatus: null, failure };
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const frontendDir = fileURLToPath(new URL('../', import.meta.url));
  nextEnv.loadEnvConfig(frontendDir, true, { info() {}, error() {} });
  const status = publicConfigStatus(process.env);
  if (process.argv.includes('--network')) {
    console.log({ ...status, network: await authReachability(process.env), loginVerified: false });
  } else {
    console.log(status);
  }
}
