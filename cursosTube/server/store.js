/**
 * Persistencia en un único fichero JSON.
 *
 * No hay base de datos: el volumen de datos de un usuario personal (cursos,
 * progreso y apuntes) cabe de sobra en memoria y se volca a disco entero.
 * Se escribe con fichero temporal + rename para que un corte de luz a mitad
 * de escritura no deje el estado corrupto.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DATA_DIR =
  process.env.CURSOS_DATA_DIR || join(import.meta.dirname, 'data');

const STATE_FILE = join(DATA_DIR, 'state.json');

/** Estado inicial: mismos nombres que los tipos del frontend (src/types/course.ts). */
const EMPTY_STATE = {
  version: 1,
  courses: {},
  progress: {},
  updatedAt: 0,
};

let state = null;

/** Cola de escrituras: serializa los volcados para que no se pisen entre sí. */
let writeQueue = Promise.resolve();

export async function initStore() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    state = { ...structuredClone(EMPTY_STATE), ...parsed };
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.error('[store] state.json ilegible, se empieza vacío:', e.message);
    }
    state = structuredClone(EMPTY_STATE);
  }
  return state;
}

export function getState() {
  if (!state) throw new Error('initStore() debe ejecutarse antes de getState()');
  return state;
}

/** Marca el estado como sucio y encola el volcado a disco. */
export function persist() {
  writeQueue = writeQueue.then(async () => {
    const snapshot = JSON.stringify(getState(), null, 2);
    const tmp = `${STATE_FILE}.tmp`;
    await writeFile(tmp, snapshot, 'utf8');
    await rename(tmp, STATE_FILE);
  }).catch((e) => {
    console.error('[store] error al guardar el estado:', e.message);
  });
  return writeQueue;
}

/** Espera a que terminen los volcados pendientes (tests / apagado). */
export function flush() {
  return writeQueue;
}

/* ============================================================
   Merge entre dispositivos
   ============================================================ */

/**
 * Curso: gana el más reciente según `updatedAt`. Los relojes de los dos
 * dispositivos pueden irse un poco, así que `>=` da prioridad a quien escribe,
 * que es el que acaba de ver el cambio en su pantalla.
 */
export function mergeCourse(existing, incoming) {
  if (!existing) return incoming;
  return (incoming?.updatedAt || 0) >= (existing.updatedAt || 0) ? incoming : existing;
}

/**
 * Progreso: se mezcla vídeo a vídeo para que guardar la posición de una
 * lección no pise los apuntes de otra. Cada entrada gana por su propio
 * `updatedAt`; los contadores globales vienen del lado más reciente.
 */
export function mergeProgress(existing, incoming) {
  if (!existing) return incoming;

  const videoProgress = { ...(existing.videoProgress || {}) };
  for (const [videoId, incomingVp] of Object.entries(incoming.videoProgress || {})) {
    const currentVp = videoProgress[videoId];
    if (!currentVp || (incomingVp.updatedAt || 0) >= (currentVp.updatedAt || 0)) {
      videoProgress[videoId] = incomingVp;
    }
  }

  // Contadores y notas generales: los del curso entero más reciente.
  const incomingIsNewer = (incoming.updatedAt || 0) >= (existing.updatedAt || 0);
  if (!incomingIsNewer) {
    return { ...existing, videoProgress };
  }

  return {
    ...existing,
    overallNotes: incoming.overallNotes,
    completedVideosCount: incoming.completedVideosCount,
    totalVideosCount: incoming.totalVideosCount,
    isCourseCompleted: incoming.isCourseCompleted,
    updatedAt: incoming.updatedAt,
    videoProgress,
  };
}
