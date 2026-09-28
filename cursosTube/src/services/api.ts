/**
 * Cliente HTTP de la API del servidor propio.
 *
 * La sesión va en una cookie httpOnly: el JS de la página no puede leerla ni
 * fabricarla, así que no hay token que.storear ni que Revocar a mano.
 */

export interface AuthUser {
  username: string;
}

export class ApiError extends Error {
  status: number;
  /** `false` cuando el fallo es de red y no hubo respuesta del servidor. */
  reached: boolean;

  constructor(message: string, status: number, reached = true) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.reached = reached;
  }
}

/** Se avisa a AuthContext cuando el servidor responde 401 en cualquier punto. */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      credentials: 'include',
      ...init,
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch {
    // fetch solo rechaza si no hubo respuesta: servidor caído o sin red.
    throw new ApiError('Sin conexión con el servidor', 0, false);
  }

  if (res.status === 204) return undefined as T;

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    /* respuesta sin cuerpo JSON */
  }

  if (!res.ok) {
    if (res.status === 401) onUnauthorized?.();
    const message =
      (payload as { error?: string } | null)?.error || `Error ${res.status} del servidor`;
    throw new ApiError(message, res.status);
  }

  return payload as T;
}

/* ============================================================
   Sesión
   ============================================================ */

export async function fetchSession(): Promise<AuthUser | null> {
  const data = await request<{ user: AuthUser | null }>('/session');
  return data.user;
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const data = await request<{ user: AuthUser }>('/session', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  return data.user;
}

export async function logout(): Promise<void> {
  await request('/session', { method: 'DELETE' });
}

/* ============================================================
   Estado (cursos y progreso)
   ============================================================ */

export async function fetchState<TCourse, TProgress>(): Promise<{
  courses: TCourse[];
  progress: Record<string, TProgress>;
}> {
  return request('/state');
}

export async function pushCourse<T extends { id: string }>(course: T): Promise<T> {
  const data = await request<{ course: T }>(`/courses/${encodeURIComponent(course.id)}`, {
    method: 'PUT',
    body: JSON.stringify(course),
  });
  return data.course;
}

export async function pushProgress<T>(courseId: string, progress: T): Promise<T> {
  const data = await request<{ progress: T }>(
    `/progress/${encodeURIComponent(courseId)}`,
    { method: 'PUT', body: JSON.stringify(progress) }
  );
  return data.progress;
}

export async function pushDelete(courseId: string): Promise<void> {
  await request(`/courses/${encodeURIComponent(courseId)}`, { method: 'DELETE' });
}

export async function fetchHealth(): Promise<{ ok: boolean; hasAccount: boolean }> {
  return request('/health');
}
