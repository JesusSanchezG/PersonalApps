import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Course, CourseProgress, UserSettings } from '../types/course';
import {
  getSavedCourses,
  saveCourses,
  getAllProgress,
  getCourseProgress,
  setVideoProgress,
  saveVideoNotes,
  saveOverallCourseNotes,
  getSettings,
  saveSettings,
  removeSyncMapEntry,
  addDeletedCourseId
} from '../services/storage';
import { createCourseFromUrl, fetchVideoOEmbed, parseYouTubeUrl } from '../services/youtube';
import { useAuth } from './AuthContext';
import { syncAll, queuePushCourse, queuePushProgress, queuePushDelete, getRemoteStats } from '../services/sync';

interface CourseContextType {
  courses: Course[];
  allProgress: Record<string, CourseProgress>;
  settings: UserSettings;
  activeCourseId: string | null;
  activeVideoId: string | null;
  activeCourse: Course | null;
  activeCourseProgress: CourseProgress | null;
  isLoading: boolean;
  isSyncing: boolean;
  isSignedIn: boolean;
  lastSyncError: string | null;
  lastSyncAt: number | null;
  remoteStats: { courses: number; progress: number; error: string | null };
  refreshSync: () => Promise<string | null>;

  // Actions
  addCourse: (url: string, customTitle?: string) => Promise<Course>;
  deleteCourse: (courseId: string) => void;
  toggleFavorite: (courseId: string) => void;
  updateCourse: (course: Course) => void;
  setActiveCourse: (courseId: string | null, initialVideoId?: string) => void;
  setActiveVideo: (videoId: string) => void;
  markVideoWatched: (courseId: string, videoId: string, watched: boolean) => void;
  saveVideoPosition: (courseId: string, videoId: string, seconds: number) => void;
  saveVideoNote: (courseId: string, videoId: string, notes: string) => void;
  saveCourseNote: (courseId: string, notes: string) => void;
  updateSettings: (newSettings: Partial<UserSettings>) => void;
  addVideoToCourse: (courseId: string, videoUrl: string, customTitle?: string) => Promise<void>;
  removeVideoFromCourse: (courseId: string, videoItemId: string) => void;
  reorderVideosInCourse: (courseId: string, newVideos: Course['videos']) => void;
}

const CourseContext = createContext<CourseContextType | undefined>(undefined);

export const CourseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [courses, setCourses] = useState<Course[]>(() => getSavedCourses());
  const [allProgress, setAllProgress] = useState<Record<string, CourseProgress>>(() => getAllProgress());
  const [settings, setSettingsState] = useState<UserSettings>(() => getSettings());
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [remoteStats, setRemoteStats] = useState<{
    courses: number;
    progress: number;
    error: string | null;
  }>({ courses: 0, progress: 0, error: null });

  // Persist to localStorage (offline cache / local-first)
  useEffect(() => {
    saveCourses(courses);
  }, [courses]);

  useEffect(() => {
    // allProgress is persisted inside each storage mutation already,
    // but keep a global save in sync with state for safety
    try {
      localStorage.setItem('yt_courses_app_progress_v1', JSON.stringify(allProgress));
    } catch {
      /* ignore quota errors */
    }
  }, [allProgress]);

  // Full sync when a user signs in / session becomes available.
  // Reusable via refreshSync (botón "Sincronizar ahora").
  const uid = userId;
  const refreshSync = useCallback(async (): Promise<string | null> => {
    if (!uid) return null;
    setIsSyncing(true);
    setLastSyncError(null);
    try {
      const res = await syncAll(uid, getSavedCourses(), getAllProgress());
      setCourses(res.courses);
      setAllProgress(res.allProgress);
      setLastSyncError(res.error);
      setLastSyncAt(Date.now());
      // Refresca el contador de lo que hay en la nube (diagnóstico)
      getRemoteStats(uid).then((stats) => setRemoteStats(stats));
      return res.error;
    } finally {
      setIsSyncing(false);
    }
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    refreshSync();
  }, [uid, refreshSync]);

  // Re-sincronización automática al volver a la pestaña (con sesión activa):
  // cubre cambios hechos en otro dispositivo mientras la app estaba en segundo plano
  useEffect(() => {
    if (!uid) return;
    const onFocus = () => {
      refreshSync();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshSync();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [uid, refreshSync]);

  // Sync periódico (cada 45s con sesión y app abierta): garantiza que los
  // cambios hechos en otros dispositivos lleguen aunque la pestaña nunca
  // pierda el foco
  useEffect(() => {
    if (!uid) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshSync();
      }
    }, 45000);
    return () => clearInterval(interval);
  }, [uid, refreshSync]);

  // Derived active course & progress
  const activeCourse = useMemo(() => {
    if (!activeCourseId) return null;
    return courses.find(c => c.id === activeCourseId) || null;
  }, [courses, activeCourseId]);

  const activeCourseProgress = useMemo(() => {
    if (!activeCourse) return null;
    return allProgress[activeCourse.id] || getCourseProgress(activeCourse);
  }, [activeCourse, allProgress]);

  // Handle setting active course and restoring last played video
  const setActiveCourse = useCallback((courseId: string | null, initialVideoId?: string) => {
    setActiveCourseId(courseId);
    if (!courseId) {
      setActiveVideoId(null);
      window.history.pushState(null, '', window.location.pathname);
      return;
    }

    const course = getSavedCourses().find(c => c.id === courseId);
    if (course && course.videos.length > 0) {
      const vid = initialVideoId || course.lastPlayedVideoId || course.videos[0].videoId;
      setActiveVideoId(vid);
      window.history.pushState(null, '', `#course=${courseId}`);
    }
  }, []);

  const setActiveVideo = useCallback((videoId: string) => {
    setActiveVideoId(videoId);
    if (activeCourseId) {
      const updated = getSavedCourses().map(c => {
        if (c.id === activeCourseId) {
          return { ...c, lastPlayedVideoId: videoId, updatedAt: Date.now() };
        }
        return c;
      });
      setCourses(updated);
      if (userId) {
        const course = updated.find(c => c.id === activeCourseId);
        if (course) queuePushCourse(userId, course);
      }
    }
  }, [activeCourseId, userId]);

  // Add course
  const addCourse = useCallback(async (url: string, customTitle?: string): Promise<Course> => {
    setIsLoading(true);
    try {
      const newCourse = await createCourseFromUrl(url, customTitle, settings.youtubeApiKey);

      setCourses(prev => [newCourse, ...prev]);

      // Initialize progress
      const initialProg = getCourseProgress(newCourse);
      setAllProgress(prev => ({ ...prev, [newCourse.id]: initialProg }));

      if (userId) {
        queuePushCourse(userId, newCourse);
        queuePushProgress(userId, newCourse, initialProg);
      }

      return newCourse;
    } finally {
      setIsLoading(false);
    }
  }, [settings.youtubeApiKey, userId]);

  // Delete course
  const deleteCourse = useCallback((courseId: string) => {
    const course = getSavedCourses().find(c => c.id === courseId);
    setCourses(prev => prev.filter(c => c.id !== courseId));
    setAllProgress(prev => {
      const copy = { ...prev };
      delete copy[courseId];
      return copy;
    });
    if (activeCourseId === courseId) {
      setActiveCourse(null);
    }
    if (userId && course) {
      queuePushDelete(userId, course);
      addDeletedCourseId(courseId);
    }
    removeSyncMapEntry(courseId);
  }, [activeCourseId, setActiveCourse, userId]);

  // Toggle favorite
  const toggleFavorite = useCallback((courseId: string) => {
    setCourses(prev => {
      const updated = prev.map(c => {
        if (c.id === courseId) {
          return { ...c, isFavorite: !c.isFavorite, updatedAt: Date.now() };
        }
        return c;
      });
      if (userId) {
        const course = updated.find(c => c.id === courseId);
        if (course) queuePushCourse(userId, course);
      }
      return updated;
    });
  }, [userId]);

  // Update course metadata
  const updateCourse = useCallback((updated: Course) => {
    setCourses(prev => prev.map(c => (c.id === updated.id ? { ...updated, updatedAt: Date.now() } : c)));
    if (userId) {
      queuePushCourse(userId, { ...updated, updatedAt: Date.now() });
    }
  }, [userId]);

  // Mark video watched / unwatched
  const markVideoWatched = useCallback((courseId: string, videoId: string, watched: boolean) => {
    const course = getSavedCourses().find(c => c.id === courseId);
    if (!course) return;

    const updated = setVideoProgress(course, videoId, { watched });
    setAllProgress(prev => ({ ...prev, [courseId]: updated }));

    if (userId) {
      queuePushProgress(userId, course, updated);
    }
  }, [userId]);

  // Save video current seconds timestamp
  const saveVideoPosition = useCallback((courseId: string, videoId: string, seconds: number) => {
    const course = getSavedCourses().find(c => c.id === courseId);
    if (!course) return;

    const updated = setVideoProgress(course, videoId, { lastPositionSeconds: seconds });
    setAllProgress(prev => ({ ...prev, [courseId]: updated }));

    // Also update course last played info
    const updatedCourses = getSavedCourses().map(c => {
      if (c.id === courseId) {
        return { ...c, lastPlayedVideoId: videoId, lastPlayedTimestamp: Math.floor(seconds), updatedAt: Date.now() };
      }
      return c;
    });
    setCourses(updatedCourses);

    if (userId) {
      queuePushProgress(userId, course, updated);
      // Only re-upload the course row when the video actually changed
      // (avoids pushing every 3s during playback)
      const updatedCourse = updatedCourses.find(c => c.id === courseId);
      if (updatedCourse && updatedCourse.lastPlayedVideoId !== course.lastPlayedVideoId) {
        queuePushCourse(userId, updatedCourse);
      }
    }
  }, [userId]);

  // Save video notes
  const saveVideoNote = useCallback((courseId: string, videoId: string, notes: string) => {
    saveVideoNotes(courseId, videoId, notes);
    setAllProgress(prev => {
      const current = prev[courseId];
      if (!current) return prev;
      const updatedProgress = {
        ...current,
        updatedAt: Date.now(),
        videoProgress: {
          ...current.videoProgress,
          [videoId]: {
            ...(current.videoProgress[videoId] || { videoId, watched: false, lastPositionSeconds: 0 }),
            notes,
            updatedAt: Date.now()
          }
        }
      };
      if (userId) {
        const course = getSavedCourses().find(c => c.id === courseId);
        if (course) queuePushProgress(userId, course, updatedProgress);
      }
      return {
        ...prev,
        [courseId]: updatedProgress
      };
    });
  }, [userId]);

  // Save general course note
  const saveCourseNote = useCallback((courseId: string, notes: string) => {
    saveOverallCourseNotes(courseId, notes);
    setAllProgress(prev => {
      const current = prev[courseId];
      if (!current) return prev;
      const updatedProgress = {
        ...current,
        overallNotes: notes,
        updatedAt: Date.now()
      };
      if (userId) {
        const course = getSavedCourses().find(c => c.id === courseId);
        if (course) queuePushProgress(userId, course, updatedProgress);
      }
      return {
        ...prev,
        [courseId]: updatedProgress
      };
    });
  }, [userId]);

  // Update user settings
  const updateSettings = useCallback((newSettings: Partial<UserSettings>) => {
    setSettingsState(prev => {
      const updated = { ...prev, ...newSettings };
      saveSettings(updated);
      return updated;
    });
  }, []);

  // Add individual video to an existing course
  const addVideoToCourse = useCallback(async (courseId: string, videoUrl: string, customTitle?: string) => {
    const course = getSavedCourses().find(c => c.id === courseId);
    if (!course) return;

    const parsed = parseYouTubeUrl(videoUrl);
    if (!parsed.isValid || !parsed.videoId) {
      throw new Error('URL de video no válida');
    }

    const meta = await fetchVideoOEmbed(parsed.videoId);
    const newVideoItem = {
      id: `${courseId}_${parsed.videoId}_${Date.now()}`,
      videoId: parsed.videoId,
      title: customTitle?.trim() || meta.title,
      thumbnailUrl: meta.thumbnailUrl,
      order: course.videos.length + 1
    };

    const updatedVideos = [...course.videos, newVideoItem];
    const updatedCourse: Course = {
      ...course,
      videos: updatedVideos,
      updatedAt: Date.now()
    };

    updateCourse(updatedCourse);
  }, [updateCourse]);

  // Remove video from course
  const removeVideoFromCourse = useCallback((courseId: string, videoItemId: string) => {
    const course = getSavedCourses().find(c => c.id === courseId);
    if (!course || course.videos.length <= 1) return;

    const updatedVideos = course.videos
      .filter(v => v.id !== videoItemId && v.videoId !== videoItemId)
      .map((v, i) => ({ ...v, order: i + 1 }));

    const updatedCourse: Course = {
      ...course,
      videos: updatedVideos,
      updatedAt: Date.now()
    };

    updateCourse(updatedCourse);
    if (activeVideoId === videoItemId) {
      setActiveVideoId(updatedVideos[0]?.videoId || null);
    }
  }, [activeVideoId, updateCourse]);

  // Reorder videos in course
  const reorderVideosInCourse = useCallback((courseId: string, newVideos: Course['videos']) => {
    const course = getSavedCourses().find(c => c.id === courseId);
    if (!course) return;

    const updatedCourse: Course = {
      ...course,
      videos: newVideos.map((v, i) => ({ ...v, order: i + 1 })),
      updatedAt: Date.now()
    };

    updateCourse(updatedCourse);
  }, [updateCourse]);

  // Check URL hash on initial load
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#course=')) {
      const courseId = hash.replace('#course=', '');
      if (getSavedCourses().some(c => c.id === courseId)) {
        setActiveCourse(courseId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({
    courses,
    allProgress,
    settings,
    activeCourseId,
    activeVideoId,
    activeCourse,
    activeCourseProgress,
    isLoading,
    isSyncing,
    isSignedIn: Boolean(userId),
    lastSyncError,
    lastSyncAt,
    remoteStats,
    refreshSync,
    addCourse,
    deleteCourse,
    toggleFavorite,
    updateCourse,
    setActiveCourse,
    setActiveVideo,
    markVideoWatched,
    saveVideoPosition,
    saveVideoNote,
    saveCourseNote,
    updateSettings,
    addVideoToCourse,
    removeVideoFromCourse,
    reorderVideosInCourse
  }), [
    courses,
    allProgress,
    settings,
    activeCourseId,
    activeVideoId,
    activeCourse,
    activeCourseProgress,
    isLoading,
    isSyncing,
    userId,
    lastSyncError,
    lastSyncAt,
    remoteStats,
    refreshSync,
    addCourse,
    deleteCourse,
    toggleFavorite,
    updateCourse,
    setActiveCourse,
    setActiveVideo,
    markVideoWatched,
    saveVideoPosition,
    saveVideoNote,
    saveCourseNote,
    updateSettings,
    addVideoToCourse,
    removeVideoFromCourse,
    reorderVideosInCourse
  ]);

  return (
    <CourseContext.Provider value={value}>
      {children}
    </CourseContext.Provider>
  );
};

export function useCourseContext() {
  const context = useContext(CourseContext);
  if (!context) {
    throw new Error('useCourseContext must be used within a CourseProvider');
  }
  return context;
}
