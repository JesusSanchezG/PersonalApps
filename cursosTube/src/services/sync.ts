/**
 * Sincronización con el servidor propio (CoursesTube API).
 *
 * El servidor es la fuente de verdad, pero el localStorage sigue siendo la
 * copia de trabajo: sin red la app se lee igual y las mutaciones se encolan.
 * Cuando vuelve la conexión, `syncAll` repara cualquier subida que se haya
 * quedado a medias comparando `updatedAt`.
 */
import type { Course, CourseProgress } from '../types/course';
import {
  ApiError,
  fetchHealth,
  fetchState,
  pushCourse,
  pushDelete,
  pushProgress,
} from './api';
import {
  getDeletedCourseIds,
  getSavedCourses,
  getAllProgress,
  saveAllProgress,
  saveCourses,
  saveDeletedCourseIds,
} from './storage';

/* ============================================================
   Descarga y fusión
   ============================================================ */

export interface SyncResult {
  courses: Course[];
  allProgress: Record<string, CourseProgress>;
  error: string | null;
}

/** Ganador por `updatedAt`. A igualdad gana lo local: quien escribe ve el cambio. */
function newerOf<T extends { updatedAt?: number }>(local: T | undefined, remote: T | undefined): T {
  if (!local) return remote as T;
  if (!remote) return local;
  return (remote.updatedAt || 0) > (local.updatedAt || 0) ? remote : local;
}

/**
 * Mezcla el progreso vídeo a vídeo: guardar la posición de una lección no
 * puede pisar los apuntes de otra.
 */
function mergeProgress(
  local: CourseProgress,
  remote: CourseProgress
): CourseProgress {
  const videoProgress = { ...local.videoProgress };
  for (const [videoId, remoteVp] of Object.entries(remote.videoProgress || {})) {
    const localVp = videoProgress[videoId];
    if (!localVp || (remoteVp.updatedAt || 0) > (localVp.updatedAt || 0)) {
      videoProgress[videoId] = remoteVp;
    }
  }

  const remoteNotesAreNewer = (remote.updatedAt || 0) > (local.updatedAt || 0);
  const watchedCount = Object.values(videoProgress).filter((vp) => vp.watched).length;
  const total = remote.totalVideosCount || local.totalVideosCount || 0;

  return {
    ...local,
    videoProgress,
    overallNotes: remoteNotesAreNewer ? remote.overallNotes : local.overallNotes,
    completedVideosCount: watchedCount,
    totalVideosCount: total,
    isCourseCompleted: total > 0 && watchedCount === total,
    updatedAt: Math.max(remote.updatedAt || 0, local.updatedAt || 0),
  };
}

export async function syncAll(): Promise<SyncResult> {
  const localCourses = getSavedCourses();
  const localProgress = getAllProgress();

  let remote: { courses: Course[]; progress: Record<string, CourseProgress> };
  try {
    remote = await fetchState<Course, CourseProgress>();
  } catch (e) {
    return {
      courses: localCourses,
      allProgress: localProgress,
      error: describeError(e, 'No se pudo contactar con el servidor'),
    };
  }

  const remoteById = new Map(remote.courses.map((c) => [c.id, c]));
  const tombstones = new Set(getDeletedCourseIds());

  // Un curso borrado aquí no debe volver por/download: fuera de la mezcla.
  for (const id of tombstones) remoteById.delete(id);

  /* 1) Borrados: propagarlos al servidor si aún siguen ahí. */
  for (const id of tombstones) {
    if (!remote.courses.some((c) => c.id === id)) continue;
    try {
      await pushDelete(id);
    } catch (e) {
      console.error('[sync] no se pudo borrar el curso del servidor:', e);
    }
  }

  /* 2) Mezclar cursos: gana el más reciente de cada lado. */
  const merged = new Map<string, Course>();
  for (const course of localCourses) {
    if (!tombstones.has(course.id)) merged.set(course.id, course);
  }
  for (const [id, remoteCourse] of remoteById) {
    merged.set(id, newerOf(merged.get(id), remoteCourse));
  }
  const mergedCourses = [...merged.values()];

  /* 3) Mezclar progreso por curso. */
  const mergedProgress: Record<string, CourseProgress> = {};
  for (const course of mergedCourses) {
    const local = localProgress[course.id];
    const remoteProg = remote.progress[course.id];
    if (local && remoteProg) mergedProgress[course.id] = mergeProgress(local, remoteProg);
    else mergedProgress[course.id] = (local || remoteProg) as CourseProgress;
  }

  /* 4) Subir lo que el servidor aún no tiene o tiene más viejo.
        Esto es lo que repara las subidas que fallaron sin conexión. */
  const toPushCourses: Course[] = [];
  for (const course of mergedCourses) {
    const serverCopy = remoteById.get(course.id);
    if (!serverCopy || (course.updatedAt || 0) > (serverCopy.updatedAt || 0)) {
      toPushCourses.push(course);
    }
  }

  for (const course of toPushCourses) {
    try {
      const saved = await pushCourse(course);
      remoteById.set(course.id, saved);
    } catch (e) {
      console.error('[sync] no se pudo subir el curso:', e);
    }
  }

  for (const courseId of Object.keys(mergedProgress)) {
    const local = localProgress[courseId];
    const serverCopy = remote.progress[courseId];
    const shouldPush = !serverCopy || (local && (local.updatedAt || 0) > (serverCopy.updatedAt || 0));
    if (!shouldPush || !local) continue;
    try {
      mergedProgress[courseId] = await pushProgress(courseId, local);
    } catch (e) {
      console.error('[sync] no se pudo subir el progreso:', e);
    }
  }

  // Los borrados ya están aplicados en el servidor: dejan de ser tombstones.
  const stillDeleted = [...tombstones].filter((id) => remoteById.has(id));
  saveDeletedCourseIds(stillDeleted);

  saveCourses(mergedCourses);
  saveAllProgress(mergedProgress);

  return { courses: mergedCourses, allProgress: mergedProgress, error: null };
}

function describeError(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    if (!e.reached) return `${fallback}: sin red. Los cambios se guardan en este dispositivo.`;
    return e.message;
  }
  return `${fallback}: ${e instanceof Error ? e.message : String(e)}`;
}

/* ============================================================
   Subidas puntuales con debounce
   ============================================================ */

type PendingPush =
  | { kind: 'course'; course: Course }
  | { kind: 'progress'; courseId: string; progress: CourseProgress }
  | { kind: 'delete'; courseId: string };

const pending = new Map<string, PendingPush>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

async function sendPush(push: PendingPush) {
  switch (push.kind) {
    case 'course':
      await pushCourse(push.course);
      break;
    case 'progress':
      await pushProgress(push.courseId, push.progress);
      break;
    case 'delete':
      await pushDelete(push.courseId);
      break;
  }
}

async function flushKey(key: string) {
  clearTimeout(timers.get(key));
  timers.delete(key);
  const push = pending.get(key);
  if (!push) return;
  pending.delete(key);
  try {
    await sendPush(push);
  } catch (e) {
    // No se pierde: syncAll repara lo que falte en el siguiente intento.
    console.warn('[sync] subida aplazada, se reintentará al sincronizar:', e);
  }
}

/** Última escritura gana: varias mutaciones seguidas = una sola petición. */
function schedule(key: string, push: PendingPush, ms: number) {
  pending.set(key, push);
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(() => void flushKey(key), ms));
}

export function queuePushCourse(course: Course) {
  schedule(`course_${course.id}`, { kind: 'course', course }, 500);
}

export function queuePushProgress(courseId: string, progress: CourseProgress) {
  schedule(`progress_${courseId}`, { kind: 'progress', courseId, progress }, 2000);
}

export function queuePushDelete(courseId: string) {
  schedule(`delete_${courseId}`, { kind: 'delete', courseId }, 300);
}

/**
 * Vacía la cola al instante. Se llama al cerrar la pestaña para que la última
 * posición de reproducción no se quede en el debounce.
 */
export function flushPendingPushes() {
  for (const key of [...timers.keys()]) void flushKey(key);
}

/* ============================================================
   Diagnóstico (botón en Ajustes)
   ============================================================ */

export interface ServerTestResult {
  ok: boolean;
  steps: { name: string; ok: boolean; detail: string }[];
  coursesInServer: number;
}

export async function testServerConnection(username: string | null): Promise<ServerTestResult> {
  const steps: ServerTestResult['steps'] = [];

  try {
    const health = await fetchHealth();
    steps.push({
      name: 'Servidor accesible',
      ok: health.ok,
      detail: health.hasAccount ? 'API viva' : 'API viva pero sin cuenta creada',
    });
    if (!health.hasAccount) {
      return { ok: false, steps, coursesInServer: 0 };
    }
  } catch (e) {
    steps.push({ name: 'Servidor accesible', ok: false, detail: describeError(e, 'Error de red') });
    return { ok: false, steps, coursesInServer: 0 };
  }

  const user = username ? `sesión de ${username}` : 'sin sesión';
  steps.push({ name: 'Sesión', ok: Boolean(username), detail: user });
  if (!username) return { ok: false, steps, coursesInServer: 0 };

  try {
    const state = await fetchState<Course, CourseProgress>();
    const count = state.courses.length;
    steps.push({ name: 'Leer tus datos', ok: true, detail: `${count} curso(s) en el servidor` });
    return { ok: true, steps, coursesInServer: count };
  } catch (e) {
    steps.push({ name: 'Leer tus datos', ok: false, detail: describeError(e, 'Error al leer') });
    return { ok: false, steps, coursesInServer: 0 };
  }
}

export async function getServerStats(): Promise<{
  courses: number;
  progress: number;
  error: string | null;
}> {
  try {
    const state = await fetchState<Course, CourseProgress>();
    return {
      courses: state.courses.length,
      progress: Object.keys(state.progress).length,
      error: null,
    };
  } catch (e) {
    return { courses: 0, progress: 0, error: describeError(e, 'Error al consultar el servidor') };
  }
}
