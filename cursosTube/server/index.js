/**
 * Servidor de la API de CursosTube. Sin dependencias externas: solo módulos
 * nativos de Node. Sirve únicamente `/api/*`; los ficheros estáticos los
 * entrega nginx desde `dist/` (ver README).
 */
import { createServer } from 'node:http';
import { chmod } from 'node:fs/promises';
import { join } from 'node:path';
import {
  SESSION_COOKIE,
  createSession,
  destroySession,
  getAccount,
  hasAccount,
  initAuth,
  verifyPassword,
  verifySession,
} from './auth.js';
import { getState, initStore, mergeCourse, mergeProgress, persist } from './store.js';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';

const DATA_DIR = process.env.CURSOS_DATA_DIR || join(import.meta.dirname, 'data');

/** En producción (nginx con TLS delante) la cookie debe llevar `Secure`. */
const SECURE_COOKIE = process.env.CURSOS_SECURE_COOKIES === '1';

const MAX_BODY_BYTES = 4 * 1024 * 1024; // margen de sobra para un curso con muchas clases

/* ============================================================
   Utilidades HTTP
   ============================================================ */

function sendJson(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...headers,
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Cuerpo demasiado grande'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('JSON inválido'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

/**
 * La cookie es SameSite=Strict, pero un POST a mismo origen desde otra
 * pestaña legítima (o un proxy mal configurado) no lleva `Origin` de un
 * atacante. Comprobarlo capa extra contra CSRF.
 */
function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // curl / healthchecks
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

/* ============================================================
   Limitador de intentos de login
   ============================================================ */

const MAX_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map();

function tooManyAttempts(ip) {
  const entry = attempts.get(ip);
  if (!entry) return false;
  if (entry.resetAt <= Date.now()) {
    attempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(ip) {
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt <= Date.now()) {
    attempts.set(ip, { count: 1, resetAt: Date.now() + ATTEMPT_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

/* ============================================================
   Validación
   ============================================================ */

const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

function validateCourse(course, urlId) {
  if (!isPlainObject(course)) return 'Curso inválido';
  if (typeof course.id !== 'string' || course.id.length === 0) return 'Falta course.id';
  if (course.id !== urlId) return 'El id del curso no coincide con la URL';
  if (typeof course.title !== 'string') return 'Falta course.title';
  if (!Array.isArray(course.videos)) return 'Falta course.videos';
  if (typeof course.updatedAt !== 'number' || !Number.isFinite(course.updatedAt)) {
    return 'Falta course.updatedAt';
  }
  return null;
}

function validateProgress(progress, urlId) {
  if (!isPlainObject(progress)) return 'Progreso inválido';
  if (typeof progress.courseId !== 'string' || progress.courseId !== urlId) {
    return 'El courseId no coincide con la URL';
  }
  if (!isPlainObject(progress.videoProgress)) return 'Falta videoProgress';
  return null;
}

/* ============================================================
   Rutas
   ============================================================ */

async function handle(req, res, url) {
  const { pathname } = url;
  const method = req.method || 'GET';
  const ip = req.socket.remoteAddress || 'desconocido';

  // --- Sin sesión: solo health y login ---
  if (pathname === '/api/health' && method === 'GET') {
    return sendJson(res, 200, { ok: true, hasAccount: hasAccount() });
  }

  if (pathname === '/api/session') {
    if (method === 'GET') {
      const user = verifySession(parseCookies(req)[SESSION_COOKIE]);
      return sendJson(res, 200, { user: user ? { username: user } : null });
    }

    if (method === 'POST') {
      if (!isSameOrigin(req)) return sendJson(res, 403, { error: 'Origen no permitido' });
      if (tooManyAttempts(ip)) {
        return sendJson(res, 429, { error: 'Demasiados intentos. Prueba más tarde.' });
      }
      if (!hasAccount()) {
        return sendJson(
          res,
          503,
          { error: 'La cuenta no está configurada en el servidor (ejecuta create-user.js).' }
        );
      }

      const body = await readJsonBody(req);
      const username = typeof body.username === 'string' ? body.username.trim() : '';
      const password = typeof body.password === 'string' ? body.password : '';

      const ok =
        username.length > 0 &&
        password.length > 0 &&
        username === getAccount().username &&
        (await verifyPassword(password, getAccount().passwordHash));

      if (!ok) {
        recordFailedAttempt(ip);
        // Mismo mensaje para usuario inexistente y contraseña incorrecta:
        // no revelamos qué cuentas existen.
        return sendJson(res, 401, { error: 'Usuario o contraseña incorrectos' });
      }

      attempts.delete(ip);
      const token = await createSession();
      return sendJson(res, 200, { user: { username } }, { 'set-cookie': sessionCookie(token) });
    }

    if (method === 'DELETE') {
      if (!isSameOrigin(req)) return sendJson(res, 403, { error: 'Origen no permitido' });
      await destroySession(parseCookies(req)[SESSION_COOKIE]);
      return sendJson(res, 200, { ok: true }, { 'set-cookie': clearSessionCookie() });
    }
  }

  // --- A partir de aquí, sesión obligatoria ---
  const user = verifySession(parseCookies(req)[SESSION_COOKIE]);
  if (!user) return sendJson(res, 401, { error: 'Sesión no válida' });

  if (!isSameOrigin(req) && method !== 'GET') {
    return sendJson(res, 403, { error: 'Origen no permitido' });
  }

  const state = getState();

  if (pathname === '/api/state' && method === 'GET') {
    return sendJson(res, 200, {
      courses: Object.values(state.courses),
      progress: state.progress,
      updatedAt: state.updatedAt,
    });
  }

  const courseMatch = pathname.match(/^\/api\/courses\/([^/]+)$/);
  if (courseMatch) {
    const id = decodeURIComponent(courseMatch[1]);

    if (method === 'PUT') {
      const body = await readJsonBody(req);
      const error = validateCourse(body, id);
      if (error) return sendJson(res, 400, { error });

      state.courses[id] = mergeCourse(state.courses[id], body);
      state.updatedAt = Date.now();
      persist();
      return sendJson(res, 200, { course: state.courses[id] });
    }

    if (method === 'DELETE') {
      if (state.courses[id]) {
        delete state.courses[id];
        delete state.progress[id]; // el progreso va siempre acoplado al curso
        state.updatedAt = Date.now();
        persist();
      }
      return sendJson(res, 200, { ok: true });
    }
  }

  const progressMatch = pathname.match(/^\/api\/progress\/([^/]+)$/);
  if (progressMatch && method === 'PUT') {
    const id = decodeURIComponent(progressMatch[1]);
    const body = await readJsonBody(req);
    const error = validateProgress(body, id);
    if (error) return sendJson(res, 400, { error });

    state.progress[id] = mergeProgress(state.progress[id], body);
    state.updatedAt = Date.now();
    persist();
    return sendJson(res, 200, { progress: state.progress[id] });
  }

  return sendJson(res, 404, { error: 'Ruta no encontrada' });
}

function sessionCookie(token) {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(30 * 24 * 60 * 60)}`,
  ];
  if (SECURE_COOKIE) parts.push('Secure');
  return parts.join('; ');
}

function clearSessionCookie() {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (SECURE_COOKIE) parts.push('Secure');
  return parts.join('; ');
}

/* ============================================================
   Arranque
   ============================================================ */

await initStore();
await initAuth();

// `data/` guarda el hash de la contraseña y las sesiones: solo root debe leerlo.
// El umask cubre los ficheros que se creen después (state.json, sessions.json);
// el chmod explícito arregla los que ya existían de un despliegue anterior.
process.umask(0o077);
for (const file of ['auth.json', 'sessions.json', 'state.json']) {
  await chmod(join(DATA_DIR, file), 0o600).catch(() => {
    // Todavía no existe: se creará con el umask de arriba.
  });
}
await chmod(DATA_DIR, 0o700).catch((e) => {
  console.warn(`[api] no se pudo ajustar permisos de ${DATA_DIR}: ${e.message}`);
});

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  // nginx reenvía la SPA a index.html; aquí solo hay API.
  if (!url.pathname.startsWith('/api/')) {
    return sendJson(res, 404, { error: 'No encontrado' });
  }

  handle(req, res, url).catch((e) => {
    console.error('[api] error no controlado:', e);
    const status = e.status || 500;
    if (!res.headersSent) {
      sendJson(res, status, { error: e.message || 'Error interno' });
    } else {
      res.end();
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[api] CursosTube escuchando en http://${HOST}:${PORT}`);
  if (!hasAccount()) {
    console.warn('[api] No hay cuenta creada. Ejecuta: node server/create-user.js');
  }
});

// Apagado limpio: termina los volcados a disco pendientes.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
