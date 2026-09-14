import type { Course, CourseProgress, VideoProgress } from '../types/course';
import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import {
  getSyncMap,
  saveSyncMap,
  getDeletedCourseIds,
  saveDeletedCourseIds,
} from './storage';

/* ============================================================
   Tipos de filas remotas (espejo del esquema SQL)
   ============================================================ */

interface CourseRow {
  id: string;
  user_id: string;
  local_id: string | null;
  youtube_url: string;
  type: string;
  playlist_id: string | null;
  title: string;
  channel_title: string | null;
  description: string | null;
  thumbnail_url: string;
  is_favorite: boolean;
  videos: unknown;
  last_played_video_id: string | null;
  last_played_timestamp: number;
  created_at: string;
  updated_at: string;
}

interface ProgressRow {
  id: string;
  user_id: string;
  course_id: string;
  video_id: string;
  watched: boolean;
  completed_at: string | null;
  last_position_seconds: number;
  notes: string;
  updated_at: string;
}

interface NotesRow {
  id: string;
  user_id: string;
  course_id: string;
  overall_notes: string;
  updated_at: string;
}

/* ============================================================
   Conversores local <-> remoto
   ============================================================ */

/**
 * Genera un UUID v4 en el navegador. Se usa como id de filas nuevas
 * para no depender del default (gen_random_uuid) de la base de datos.
 */
function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function rowToCourse(row: CourseRow): Course {
  const localId = row.local_id || `remote_${row.id}`;
  return {
    id: localId,
    youtubeUrl: row.youtube_url,
    type: (row.type as Course['type']) || 'playlist',
    playlistId: row.playlist_id || undefined,
    title: row.title,
    channelTitle: row.channel_title || undefined,
    description: row.description || undefined,
    thumbnailUrl: row.thumbnail_url,
    isFavorite: row.is_favorite,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    lastPlayedVideoId: row.last_played_video_id || undefined,
    lastPlayedTimestamp: row.last_played_timestamp || 0,
    videos: Array.isArray(row.videos) ? (row.videos as Course['videos']) : [],
  };
}

function courseToRow(course: Course, userId: string, map: Record<string, string>): CourseRow {
  return {
    id: map[course.id] || uuid(),
    user_id: userId,
    local_id: course.id,
    youtube_url: course.youtubeUrl,
    type: course.type,
    playlist_id: course.playlistId || null,
    title: course.title,
    channel_title: course.channelTitle || null,
    description: course.description || null,
    thumbnail_url: course.thumbnailUrl,
    is_favorite: course.isFavorite,
    videos: course.videos,
    last_played_video_id: course.lastPlayedVideoId || null,
    last_played_timestamp: Math.floor(course.lastPlayedTimestamp || 0),
    created_at: new Date(course.createdAt || Date.now()).toISOString(),
    updated_at: new Date(course.updatedAt || Date.now()).toISOString(),
  };
}

function progressToRow(
  userId: string,
  courseId: string,
  vp: VideoProgress
): ProgressRow {
  return {
    id: uuid(),
    user_id: userId,
    course_id: courseId,
    video_id: vp.videoId,
    watched: vp.watched,
    completed_at: vp.completedAt ? new Date(vp.completedAt).toISOString() : null,
    last_position_seconds: Math.floor(vp.lastPositionSeconds || 0),
    notes: vp.notes || '',
    updated_at: new Date(vp.updatedAt || Date.now()).toISOString(),
  };
}

function rowToVideoProgress(row: ProgressRow): VideoProgress {
  return {
    videoId: row.video_id,
    watched: row.watched,
    completedAt: row.completed_at ? new Date(row.completed_at).getTime() : undefined,
    lastPositionSeconds: row.last_position_seconds || 0,
    notes: row.notes || '',
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

/* ============================================================
   Sincronización completa (login / inicio de sesión activa)
   Estrategia: subir todo lo local -> traer remoto -> merge
   por updatedAt (gana el más reciente; empate -> local).
   ============================================================ */

export async function syncAll(
  userId: string,
  localCourses: Course[],
  localProgress: Record<string, CourseProgress>
): Promise<{
  courses: Course[];
  allProgress: Record<string, CourseProgress>;
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return { courses: localCourses, allProgress: localProgress, error: 'Supabase no configurado' };
  }

  const client = await getSupabase();
  if (!client) {
    return { courses: localCourses, allProgress: localProgress, error: 'Supabase no configurado' };
  }

  try {
    // 1) Subir cursos (upsert por user_id+local_id) y obtener el mapa de ids
    const map = { ...getSyncMap() };

    if (localCourses.length > 0) {
      const rows = localCourses.map((c) => courseToRow(c, userId, map));
      const { data, error } = await client
        .from('courses')
        .upsert(rows, { onConflict: 'user_id,local_id' })
        .select('id,local_id');
      if (error) {
        console.error('[sync] error al subir cursos:', error);
        return {
          courses: localCourses,
          allProgress: localProgress,
          error: `No se pudieron subir los cursos: ${error.message}`,
        };
      }
      if (data) {
        for (const r of data as { id: string; local_id: string | null }[]) {
          if (r.local_id) map[r.local_id] = r.id;
        }
      }
    }

    // 2) Subir progreso y notas de cada curso local
    for (const course of localCourses) {
      const remoteId = map[course.id];
      const prog = localProgress[course.id];
      if (!remoteId || !prog) continue;

      const rows = Object.values(prog.videoProgress)
        .filter((vp) => vp.videoId)
        .map((vp) => progressToRow(userId, remoteId, vp));
      if (rows.length > 0) {
        const { error: progError } = await client
          .from('video_progress')
          .upsert(rows, { onConflict: 'user_id,course_id,video_id' });
        if (progError) {
          console.error('[sync] error al subir progreso:', progError);
          return {
            courses: localCourses,
            allProgress: localProgress,
            error: `No se pudo subir el progreso: ${progError.message}`,
          };
        }
      }
      const { error: notesError } = await client
        .from('course_notes')
        .upsert(
          {
            id: uuid(),
            user_id: userId,
            course_id: remoteId,
            overall_notes: prog.overallNotes || '',
            updated_at: new Date(prog.updatedAt || Date.now()).toISOString(),
          },
          { onConflict: 'user_id,course_id' }
        );
      if (notesError) {
        console.error('[sync] error al subir notas:', notesError);
        return {
          courses: localCourses,
          allProgress: localProgress,
          error: `No se pudieron subir las notas: ${notesError.message}`,
        };
      }
    }

    saveSyncMap(map);

    // 3) Traer datos remotos
    const { data: courseRows, error: pullCoursesError } = await client
      .from('courses')
      .select('*')
      .eq('user_id', userId);

    if (pullCoursesError) {
      console.error('[sync] error al descargar cursos:', pullCoursesError);
      return {
        courses: localCourses,
        allProgress: localProgress,
        error: 'No se pudieron descargar los cursos de la nube. Revisa tu conexión e inténtalo de nuevo.',
      };
    }

    const remoteCourses: Course[] = [];
    const remoteUuids: string[] = [];
    const remoteByLocal = new Map<string, Course>();

    for (const row of (courseRows || []) as CourseRow[]) {
      const c = rowToCourse(row);
      remoteCourses.push(c);
      remoteUuids.push(row.id);
      if (row.local_id) {
        remoteByLocal.set(row.local_id, c);
        map[row.local_id] = row.id;
      }
    }

    // 3b) Tombstones: borra del servidor los cursos eliminados localmente
    //     (evita que se "resuciten" al sincronizar desde otro dispositivo).
    const deletedIds = getDeletedCourseIds();
    if (deletedIds.length > 0) {
      const remainingTombstones: string[] = [];
      for (const localId of deletedIds) {
        const remoteRow = (courseRows || []).find((r) => r.local_id === localId);
        if (!remoteRow) continue; // ya no existe en el servidor: nada que borrar
        const { error } = await client
          .from('courses')
          .delete()
          .eq('id', remoteRow.id)
          .eq('user_id', userId);
        if (error) {
          remainingTombstones.push(localId);
        }
      }
      saveDeletedCourseIds(remainingTombstones);
    }

    let progressRows: ProgressRow[] = [];
    let notesRows: NotesRow[] = [];
    if (remoteUuids.length > 0) {
      const [{ data: p, error: progressError }, { data: n, error: notesError }] = await Promise.all([
        client.from('video_progress').select('*').in('course_id', remoteUuids),
        client.from('course_notes').select('*').in('course_id', remoteUuids),
      ]);
      if (progressError) console.error('[sync] error al descargar progreso:', progressError);
      if (notesError) console.error('[sync] error al descargar notas:', notesError);
      progressRows = (p || []) as ProgressRow[];
      notesRows = (n || []) as NotesRow[];
    }

    // 4) Fusionar cursos (gana el más reciente por updatedAt)
    const mergedCourses: Course[] = [...localCourses];
    const localIndex = new Map(mergedCourses.map((c, i) => [c.id, i]));

    for (const rc of remoteCourses) {
      const idx = localIndex.get(rc.id);
      if (idx === undefined) {
        mergedCourses.push(rc);
        localIndex.set(rc.id, mergedCourses.length - 1);
      } else if (rc.updatedAt > mergedCourses[idx].updatedAt) {
        mergedCourses[idx] = rc;
      }
    }

    // 5) Fusionar progreso (por video, gana updatedAt más reciente)
    const mergedProgress: Record<string, CourseProgress> = { ...localProgress };

    const remoteProgressByCourse = new Map<string, CourseProgress>();
    for (const row of courseRows || []) {
      const r = row as CourseRow;
      const localId = r.local_id || `remote_${r.id}`;
      const vp: Record<string, VideoProgress> = {};
      for (const pr of progressRows.filter((x) => x.course_id === r.id)) {
        vp[pr.video_id] = rowToVideoProgress(pr);
      }
      const notes = notesRows.find((x) => x.course_id === r.id);
      const videoCount = Array.isArray(r.videos) ? (r.videos as unknown[]).length : 0;
      const watchedCount = Object.values(vp).filter((x) => x.watched).length;
      remoteProgressByCourse.set(localId, {
        courseId: localId,
        completedVideosCount: watchedCount,
        totalVideosCount: videoCount,
        isCourseCompleted: videoCount > 0 && watchedCount === videoCount,
        overallNotes: notes?.overall_notes || '',
        videoProgress: vp,
        updatedAt: notes ? new Date(notes.updated_at).getTime() : undefined,
      });
    }

    for (const [cid, remoteProg] of remoteProgressByCourse) {
      const localProg = mergedProgress[cid];
      if (!localProg) {
        mergedProgress[cid] = remoteProg;
        continue;
      }

      const videoProgress = { ...localProg.videoProgress };
      for (const [vid, rp] of Object.entries(remoteProg.videoProgress)) {
        const lp = videoProgress[vid];
        if (!lp || (rp.updatedAt || 0) > (lp.updatedAt || 0)) {
          videoProgress[vid] = rp;
        }
      }

      const remoteNotesNewer =
        remoteProg.overallNotes &&
        (remoteProg.updatedAt || 0) > (localProg.updatedAt || 0);

      const watchedCount = Object.values(videoProgress).filter((x) => x.watched).length;
      mergedProgress[cid] = {
        ...localProg,
        videoProgress,
        completedVideosCount: watchedCount,
        totalVideosCount: remoteProg.totalVideosCount || localProg.totalVideosCount,
        isCourseCompleted:
          (remoteProg.totalVideosCount || localProg.totalVideosCount) > 0 &&
          watchedCount === (remoteProg.totalVideosCount || localProg.totalVideosCount),
        overallNotes: remoteNotesNewer ? remoteProg.overallNotes : localProg.overallNotes,
        updatedAt: Math.max(remoteProg.updatedAt || 0, localProg.updatedAt || 0),
      };
    }

    saveSyncMap(map);
    return { courses: mergedCourses, allProgress: mergedProgress, error: null };
  } catch (e) {
    console.error('Sync error:', e);
    return {
      courses: localCourses,
      allProgress: localProgress,
      error: `Error al sincronizar con la nube: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/* ============================================================
   Diagnóstico de conexión paso a paso (botón en Ajustes).
   Muestra exactamente en qué punto falla la comunicación
   con Supabase desde el navegador.
   ============================================================ */

export interface CloudTestResult {
  ok: boolean;
  steps: { name: string; ok: boolean; detail: string }[];
  coursesInCloud: number;
}

export async function testCloudConnection(userId: string): Promise<CloudTestResult> {
  const steps: CloudTestResult['steps'] = [];

  if (!isSupabaseConfigured) {
    return {
      ok: false,
      steps: [{ name: 'Configuración', ok: false, detail: 'Supabase no configurado en el .env del build' }],
      coursesInCloud: 0,
    };
  }

  const client = await getSupabase().catch((e) => {
    steps.push({ name: 'Cargar librería Supabase', ok: false, detail: String(e) });
    return null;
  });
  if (!client) {
    if (steps.length === 0) {
      steps.push({ name: 'Cargar librería Supabase', ok: false, detail: 'Cliente no disponible' });
    }
    return { ok: false, steps, coursesInCloud: 0 };
  }
  steps.push({ name: 'Cargar librería Supabase', ok: true, detail: 'Cliente creado correctamente' });

  const { data: userRes, error: userErr } = await client.auth.getUser();
  if (userErr || !userRes?.user) {
    steps.push({
      name: 'Sesión de usuario',
      ok: false,
      detail: userErr?.message || 'No hay sesión activa',
    });
    return { ok: false, steps, coursesInCloud: 0 };
  }
  steps.push({
    name: 'Sesión de usuario',
    ok: true,
    detail: `${userRes.user.email || 'usuario'} (${userRes.user.id.slice(0, 8)}…)`,
  });

  const { data, error } = await client.from('courses').select('id').eq('user_id', userId);
  if (error) {
    steps.push({
      name: 'Leer tabla courses',
      ok: false,
      detail: `${error.code || 'HTTP'}: ${error.message}`,
    });
    return { ok: false, steps, coursesInCloud: 0 };
  }
  steps.push({
    name: 'Leer tabla courses',
    ok: true,
    detail: `${(data || []).length} fila(s) encontradas para este usuario`,
  });

  return { ok: true, steps, coursesInCloud: (data || []).length };
}

/* ============================================================
   Pushes puntuales (mutaciones en tiempo real, con debounce)
   ============================================================ */

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function debounced(key: string, ms: number, fn: () => void) {
  clearTimeout(timers.get(key));
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      fn();
    }, ms)
  );
}

export function queuePushCourse(userId: string, course: Course) {
  if (!isSupabaseConfigured) return;
  debounced(`course_${course.id}`, 500, async () => {
    const client = await getSupabase();
    if (!client) return;
    const map = { ...getSyncMap() };
    const { data, error } = await client
      .from('courses')
      .upsert([courseToRow(course, userId, map)], { onConflict: 'user_id,local_id' })
      .select('id,local_id');
    if (!error && data && data[0]) {
      const r = data[0] as { id: string; local_id: string | null };
      if (r.local_id) {
        map[r.local_id] = r.id;
        saveSyncMap(map);
      }
    } else if (error) {
      console.error('[sync] error al subir curso:', error);
    }
  });
}

export function queuePushProgress(
  userId: string,
  course: Course,
  progress: CourseProgress
) {
  if (!isSupabaseConfigured) return;
  debounced(`progress_${course.id}`, 2000, async () => {
    const client = await getSupabase();
    if (!client) return;
    const remoteId = getSyncMap()[course.id];
    if (!remoteId) return;
    const rows = Object.values(progress.videoProgress)
      .filter((vp) => vp.videoId)
      .map((vp) => progressToRow(userId, remoteId, vp));
    if (rows.length > 0) {
      const { error } = await client
        .from('video_progress')
        .upsert(rows, { onConflict: 'user_id,course_id,video_id' });
      if (error) console.error('[sync] error al subir progreso:', error);
    }
    const { error: notesError } = await client
      .from('course_notes')
      .upsert(
        {
          id: uuid(),
          user_id: userId,
          course_id: remoteId,
          overall_notes: progress.overallNotes || '',
          updated_at: new Date(progress.updatedAt || Date.now()).toISOString(),
        },
        { onConflict: 'user_id,course_id' }
      );
    if (notesError) console.error('[sync] error al subir notas:', notesError);
  });
}

export function queuePushDelete(userId: string, course: Course) {
  if (!isSupabaseConfigured) return;
  const remoteId = getSyncMap()[course.id];
  if (!remoteId) return;
  debounced(`delete_${course.id}`, 300, async () => {
    const client = await getSupabase();
    if (!client) return;
    const { error } = await client
      .from('courses')
      .delete()
      .eq('id', remoteId)
      .eq('user_id', userId);
    if (error) console.error('[sync] error al borrar curso remoto:', error);
    const map = getSyncMap();
    delete map[course.id];
    saveSyncMap(map);
  });
}

/* ============================================================
   Diagnóstico: cuántos cursos/progreso hay en la nube para el
   usuario actual (se muestra en Ajustes para verificar que la
   cuenta de cada dispositivo es la misma y que sí se guarda).
   ============================================================ */

export async function getRemoteStats(
  userId: string
): Promise<{ courses: number; progress: number; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { courses: 0, progress: 0, error: 'Supabase no configurado' };
  }
  try {
    const client = await getSupabase();
    if (!client) return { courses: 0, progress: 0, error: 'Supabase no configurado' };
    const [{ data: c, error: e1 }, { data: p, error: e2 }] = await Promise.all([
      client.from('courses').select('id').eq('user_id', userId),
      client.from('video_progress').select('id').eq('user_id', userId),
    ]);
    if (e1 || e2) {
      console.error('[sync] error al consultar estadísticas:', e1 || e2);
      return { courses: 0, progress: 0, error: 'Error al consultar la nube' };
    }
    return { courses: (c || []).length, progress: (p || []).length, error: null };
  } catch (e) {
    console.error('[sync] error en getRemoteStats:', e);
    return { courses: 0, progress: 0, error: 'Error al consultar la nube' };
  }
}
