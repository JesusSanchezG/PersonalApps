/**
 * Cuenta única + sesiones, con módulos nativos de Node (crypto).
 *
 * - Contraseña: scrypt con sal por cuenta. Nunca se guarda en claro.
 * - Sesión: token opaco de 32 bytes enviado en cookie httpOnly. En disco solo
 *   se guarda el SHA-256 del token, así que leer `sessions.json` no permite
 *   suplantar a nadie.
 */
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

const DATA_DIR =
  process.env.CURSOS_DATA_DIR || join(import.meta.dirname, 'data');

const AUTH_FILE = join(DATA_DIR, 'auth.json');
const SESSIONS_FILE = join(DATA_DIR, 'sessions.json');

/** 30 días, con renovación deslizante en cada petición válida. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const SESSION_COOKIE = 'cursos_session';

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 };

let account = null;
let sessions = {};

export async function initAuth() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    account = JSON.parse(await readFile(AUTH_FILE, 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.error('[auth] auth.json ilegible:', e.message);
    }
    account = null;
  }

  try {
    sessions = JSON.parse(await readFile(SESSIONS_FILE, 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.error('[auth] sessions.json ilegible:', e.message);
    }
    sessions = {};
  }

  // Poda de sesiones caducadas al arrancar.
  const now = Date.now();
  let changed = false;
  for (const [key, value] of Object.entries(sessions)) {
    if (!value?.expiresAt || value.expiresAt <= now) {
      delete sessions[key];
      changed = true;
    }
  }
  if (changed) await saveSessions();
}

export function getAccount() {
  return account;
}

export function hasAccount() {
  return Boolean(account?.username);
}

/* ============================================================
   Contraseña
   ============================================================ */

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
  });
  return [
    'scrypt',
    SCRYPT_PARAMS.N,
    SCRYPT_PARAMS.r,
    SCRYPT_PARAMS.p,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [scheme, N, r, p, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt') return false;

  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  const derived = await scryptAsync(password, salt, expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  return timingSafeEqual(derived, expected);
}

/**
 * Guarda la cuenta. Solo la usa el script de creación; el login nunca crea
 * cuentas (así nadie puede reclamar un servidor recién desplegado).
 */
export async function saveAccount(username, password) {
  account = {
    username,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  await writeJson(AUTH_FILE, account);
  return account;
}

/* ============================================================
   Sesiones
   ============================================================ */

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export async function createSession() {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  sessions[hashToken(token)] = { createdAt: now, expiresAt: now + SESSION_TTL_MS };
  await saveSessions();
  return token;
}

/** Devuelve el nombre de usuario si el token sigue siendo válido; renueva su caducidad. */
export function verifySession(token) {
  if (!token || !account) return null;
  const key = hashToken(token);
  const session = sessions[key];
  if (!session) return null;

  if (session.expiresAt <= Date.now()) {
    delete sessions[key];
    void saveSessions();
    return null;
  }

  // Renovación deslizante: no expire la sesión si se está usando.
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  void saveSessions();
  return account.username;
}

export async function destroySession(token) {
  if (!token) return;
  if (delete sessions[hashToken(token)]) await saveSessions();
}

async function saveSessions() {
  await writeJson(SESSIONS_FILE, sessions);
}

async function writeJson(file, value) {
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  await rename(tmp, file);
}
