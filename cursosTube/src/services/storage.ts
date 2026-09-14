import type { Course, CourseProgress, VideoProgress, UserSettings } from '../types/course';

const STORAGE_KEYS = {
  COURSES: 'yt_courses_app_courses_v1',
  PROGRESS: 'yt_courses_app_progress_v1',
  SETTINGS: 'yt_courses_app_settings_v1',
  SYNC_MAP: 'yt_courses_app_sync_map_v1',
};

export const DEFAULT_SETTINGS: UserSettings = {
  autoPlayNext: true,
  autoPlayDelaySeconds: 1, // 1 second as requested by user
  playbackSpeed: 1,
  saveIntervalSeconds: 5,
};

/**
 * Load all courses from LocalStorage
 */
export function getSavedCourses(): Course[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COURSES);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading courses from localStorage:', e);
    return [];
  }
}

/**
 * Save courses list to LocalStorage
 */
export function saveCourses(courses: Course[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(courses));
  } catch (e) {
    console.error('Error saving courses to localStorage:', e);
  }
}

/**
 * Load all course progress objects
 */
export function getAllProgress(): Record<string, CourseProgress> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROGRESS);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading progress from localStorage:', e);
    return {};
  }
}

/**
 * Save all progress
 */
export function saveAllProgress(allProgress: Record<string, CourseProgress>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(allProgress));
  } catch (e) {
    console.error('Error saving progress to localStorage:', e);
  }
}

/**
 * Get or initialize progress for a specific course
 */
export function getCourseProgress(course: Course): CourseProgress {
  const allProgress = getAllProgress();
  if (allProgress[course.id]) {
    return allProgress[course.id];
  }

  // Initialize fresh progress
  const videoProgress: Record<string, VideoProgress> = {};
  course.videos.forEach(v => {
    videoProgress[v.videoId] = {
      videoId: v.videoId,
      watched: false,
      lastPositionSeconds: 0,
      notes: ''
    };
  });

  const newProgress: CourseProgress = {
    courseId: course.id,
    completedVideosCount: 0,
    totalVideosCount: course.videos.length,
    isCourseCompleted: false,
    overallNotes: '',
    videoProgress
  };

  allProgress[course.id] = newProgress;
  saveAllProgress(allProgress);
  return newProgress;
}

/**
 * Update video progress for a course
 */
export function setVideoProgress(
  course: Course,
  videoId: string,
  updates: Partial<VideoProgress>
): CourseProgress {
  const allProgress = getAllProgress();
  const current = allProgress[course.id] || getCourseProgress(course);

  const existingVideoProg = current.videoProgress[videoId] || {
    videoId,
    watched: false,
    lastPositionSeconds: 0,
    notes: ''
  };

  const updatedVideoProg: VideoProgress = {
    ...existingVideoProg,
    ...updates,
    videoId,
    updatedAt: Date.now()
  };

  if (updates.watched && !existingVideoProg.watched) {
    updatedVideoProg.completedAt = Date.now();
  }

  const updatedVideoProgress = {
    ...current.videoProgress,
    [videoId]: updatedVideoProg
  };

  // Recalculate completed count
  const completedCount = Object.values(updatedVideoProgress).filter(p => p.watched).length;
  const isCompleted = completedCount > 0 && completedCount === course.videos.length;

  const updatedCourseProgress: CourseProgress = {
    ...current,
    completedVideosCount: completedCount,
    totalVideosCount: course.videos.length,
    isCourseCompleted: isCompleted,
    videoProgress: updatedVideoProgress,
    updatedAt: Date.now()
  };

  allProgress[course.id] = updatedCourseProgress;
  saveAllProgress(allProgress);

  return updatedCourseProgress;
}

/**
 * Save user notes for a specific video
 */
export function saveVideoNotes(
  courseId: string,
  videoId: string,
  notes: string
): void {
  const allProgress = getAllProgress();
  const current = allProgress[courseId];
  if (!current) return;

  if (!current.videoProgress[videoId]) {
    current.videoProgress[videoId] = {
      videoId,
      watched: false,
      lastPositionSeconds: 0,
      notes,
      updatedAt: Date.now()
    };
  } else {
    current.videoProgress[videoId].notes = notes;
    current.videoProgress[videoId].updatedAt = Date.now();
  }

  current.updatedAt = Date.now();
  allProgress[courseId] = current;
  saveAllProgress(allProgress);
}

/**
 * Save overall course notes
 */
export function saveOverallCourseNotes(courseId: string, notes: string): void {
  const allProgress = getAllProgress();
  if (!allProgress[courseId]) return;

  allProgress[courseId].overallNotes = notes;
  allProgress[courseId].updatedAt = Date.now();
  saveAllProgress(allProgress);
}

/**
 * Sync map: local course id -> remote Supabase course uuid
 */
export function getSyncMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SYNC_MAP);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveSyncMap(map: Record<string, string>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SYNC_MAP, JSON.stringify(map));
  } catch (e) {
    console.error('Error saving sync map:', e);
  }
}

export function removeSyncMapEntry(courseId: string): void {
  const map = getSyncMap();
  if (!(courseId in map)) return;
  delete map[courseId];
  saveSyncMap(map);
}

/**
 * Tombstones: ids of courses deleted locally, so a later sync on another
 * device does not resurrect them from the cloud.
 */
const DELETED_KEY = 'yt_courses_app_deleted_v1';

export function getDeletedCourseIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDeletedCourseIds(ids: string[]): void {
  try {
    localStorage.setItem(DELETED_KEY, JSON.stringify([...new Set(ids)]));
  } catch (e) {
    console.error('Error saving deleted ids:', e);
  }
}

export function addDeletedCourseId(courseId: string): void {
  const ids = getDeletedCourseIds();
  if (ids.includes(courseId)) return;
  ids.push(courseId);
  saveDeletedCourseIds(ids);
}

/**
 * Load user settings
 */
export function getSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    console.error('Error reading settings from localStorage:', e);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save user settings
 */
export function saveSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving settings to localStorage:', e);
  }
}
