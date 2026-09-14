import React, { useState, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  Star,
  Award
} from 'lucide-react';
import { useCourseContext } from '../../context/CourseContext';
import { YouTubePlayer } from './YouTubePlayer';
import { VideoInfo } from './VideoInfo';
import { CourseNotes } from './CourseNotes';
import { CourseSidebar } from './CourseSidebar';
import { AutoPlayCountdown } from './AutoPlayCountdown';
import { AddLessonModal } from './AddLessonModal';

export const CourseView: React.FC = () => {
  const {
    activeCourse,
    activeVideoId,
    activeCourseProgress,
    settings,
    setActiveCourse,
    setActiveVideo,
    markVideoWatched,
    saveVideoPosition,
    saveVideoNote,
    saveCourseNote,
    toggleFavorite,
    addVideoToCourse,
    removeVideoFromCourse
  } = useCourseContext();

  const [isAddLessonOpen, setIsAddLessonOpen] = useState(false);
  const [autoPlayNextVideo, setAutoPlayNextVideo] = useState<any | null>(null);
  const [currentVideoTime, setCurrentVideoTime] = useState<number>(0);
  // Al entrar al curso (desde el home) se retoma donde quedó (checkpoint).
  // Cualquier selección manual de una clase (temario, anterior/siguiente o
  // autoplay) arranca desde 0 para que no salte sola a la siguiente.
  const [resumeFromCheckpoint, setResumeFromCheckpoint] = useState(true);
  const playerInstanceRef = useRef<any>(null);
  // Marca la posición de reanudación y su instante para detectar el caso de
  // una clase que quedó "al filo" del final: si termina a los pocos segundos
  // de abrir el curso, es una re-visita de una lección ya vista y debe
  // reiniciarse en 0 en lugar de saltar sola a la siguiente.
  const initialTimeRef = useRef<number>(0);
  const resumeStartTsRef = useRef<number>(Date.now());

  // Find active video item (values may be empty while course is loading)
  const videos = activeCourse?.videos ?? [];
  const currentVideoIndex = videos.findIndex((v) => v.videoId === activeVideoId);
  const currentVideo = currentVideoIndex >= 0 ? videos[currentVideoIndex] : videos[0];
  const effectiveVideoId = currentVideo?.videoId || '';
  const courseId = activeCourse?.id ?? '';

  const prevVideo = currentVideoIndex > 0 ? videos[currentVideoIndex - 1] : null;
  const nextVideo = currentVideoIndex < videos.length - 1 ? videos[currentVideoIndex + 1] : null;

  // Active video progress & notes
  const currentVideoProg = activeCourseProgress?.videoProgress[effectiveVideoId];
  const isCurrentWatched = currentVideoProg?.watched || false;
  const currentVideoNotes = currentVideoProg?.notes || '';
  const overallNotes = activeCourseProgress?.overallNotes || '';

  // Initial resume time: al entrar al curso se retoma la posición guardada,
  // aunque la clase ya esté marcada como vista (permite re-revisarla donde
  // quedó). Si la posición guardada está a menos de 3s del final, el
  // reproductor la recorta a 0 para que una lección terminada no se auto-avance.
  const initialTime = resumeFromCheckpoint ? (currentVideoProg?.lastPositionSeconds || 0) : 0;
  initialTimeRef.current = initialTime;

  // Shared handler: any manual video selection starts playback from 0
  const handleSelectVideo = useCallback((videoId: string) => {
    setResumeFromCheckpoint(false);
    setAutoPlayNextVideo(null);
    resumeStartTsRef.current = Date.now();
    setActiveVideo(videoId);
  }, [setActiveVideo]);

  // Auto-mark watched & handle autoplay countdown when video ends
  const handleVideoEnded = useCallback(() => {
    if (!courseId || !effectiveVideoId) return;

    // Si el curso se acaba de abrir retomando una posición muy cerca del
    // final (lección ya vista), el video termina al instante: retrocede al
    // inicio para revisarla desde 0 y no salte sola a la siguiente clase.
    if (
      initialTimeRef.current > 0 &&
      isCurrentWatched &&
      Date.now() - resumeStartTsRef.current < 8000
    ) {
      if (playerInstanceRef.current && typeof playerInstanceRef.current.seekTo === 'function') {
        try {
          playerInstanceRef.current.seekTo(0, true);
          playerInstanceRef.current.playVideo();
          return;
        } catch {
          // fallback: permisos de autoplay bloqueados
        }
      }
    }

    // 1. Mark current video as watched (automatic green dot)
    markVideoWatched(courseId, effectiveVideoId, true);

    // 2. If all videos completed, trigger celebratory confetti!
    const updatedCompleted = (activeCourseProgress?.completedVideosCount || 0) + (isCurrentWatched ? 0 : 1);
    if (updatedCompleted >= videos.length) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    // 3. If there is a next video and autoplay is enabled, start countdown
    if (nextVideo && settings.autoPlayNext) {
      setAutoPlayNextVideo(nextVideo);
    }
  }, [
    courseId,
    effectiveVideoId,
    markVideoWatched,
    activeCourseProgress,
    isCurrentWatched,
    videos.length,
    nextVideo,
    settings.autoPlayNext
  ]);

  // Periodic time updates from player
  const handleTimeUpdate = useCallback((seconds: number) => {
    setCurrentVideoTime(seconds);
    if (courseId && effectiveVideoId) {
      saveVideoPosition(courseId, effectiveVideoId, seconds);
    }
  }, [courseId, effectiveVideoId, saveVideoPosition]);

  // Jump to next video from countdown or button (always starts from 0)
  const handlePlayNext = useCallback(() => {
    if (nextVideo) {
      setAutoPlayNextVideo(null);
      setResumeFromCheckpoint(false);
      setActiveVideo(nextVideo.videoId);
    }
  }, [nextVideo, setActiveVideo]);

  // Jump to timestamp in player
  const handleSeekToTime = useCallback((seconds: number) => {
    if (playerInstanceRef.current && typeof playerInstanceRef.current.seekTo === 'function') {
      try {
        playerInstanceRef.current.seekTo(seconds, true);
        playerInstanceRef.current.playVideo();
      } catch (e) {
        console.warn('Seek error:', e);
      }
    }
  }, []);

  // Completion calculation
  const completedCount = activeCourseProgress?.completedVideosCount || 0;
  const totalCount = videos.length;
  const isCourseFinished = completedCount === totalCount && totalCount > 0;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Guard AFTER all hooks (Rules of Hooks): no course selected
  if (!activeCourse) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-sm text-fg-muted mb-4">No se ha seleccionado ningún curso.</p>
          <button
            onClick={() => setActiveCourse(null)}
            className="px-4 py-2 rounded-xl bg-btn text-white text-xs font-semibold"
          >
            Volver a inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page text-fg flex flex-col font-sans selection:bg-btn selection:text-white">
      {/* 1. Header (Full Width Top Bar) */}
      <header className="sticky top-0 z-30 bg-page/95 backdrop-blur-md border-b border-line px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        {/* Left: Back to Home & Course Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setActiveCourse(null)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface hover:bg-surface-2 text-xs font-semibold text-fg transition-colors shrink-0"
            title="Volver a la lista de cursos"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Inicio</span>
          </button>

          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-bold text-fg truncate">
              {activeCourse.title}
            </h1>
            <p className="text-[11px] text-fg-muted truncate hidden sm:block">
              {activeCourse.channelTitle || 'YouTube'} &bull; Lección {currentVideoIndex + 1} de {totalCount}
            </p>
          </div>
        </div>

        {/* Right: Course Progress Badge & Favorite */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Progress Bar Badge */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-surface border border-line text-xs">
            {isCourseFinished ? (
              <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                <Award className="w-4 h-4" />
                <span>100% Completado</span>
              </div>
            ) : (
              <>
                <span className="font-semibold text-fg-soft">{percent}%</span>
                <div className="w-16 h-1.5 bg-line rounded-full overflow-hidden hidden xs:block">
                  <div
                    className="h-full bg-btn rounded-full transition-all duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </>
            )}
          </div>

          {/* Favorite Star */}
          <button
            onClick={() => toggleFavorite(activeCourse.id)}
            className={`p-2 rounded-xl border transition-all ${
              activeCourse.isFavorite
                ? 'bg-amber-400 text-fg border-amber-300 shadow-xs'
                : 'bg-surface text-fg-muted hover:text-fg border-line'
            }`}
            title={activeCourse.isFavorite ? 'Quitar de favoritos' : 'Marcar favorito'}
          >
            <Star className={`w-4 h-4 ${activeCourse.isFavorite ? 'fill-fg' : ''}`} />
          </button>
        </div>
      </header>

      {/* 2. Main Content Grid (Adapted to image structure: Left [Video + Info] & Right [Notas + Lista de Clases]) */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto p-3 sm:p-5 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column (Play Video + Información del Video) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            {/* Play Video Section */}
            <div className="flex flex-col gap-3">
              {/* Autoplay Next Countdown Banner if triggered */}
              {autoPlayNextVideo && (
                <AutoPlayCountdown
                  nextVideo={autoPlayNextVideo}
                  delaySeconds={settings.autoPlayDelaySeconds || 1}
                  onPlayNext={handlePlayNext}
                  onCancel={() => setAutoPlayNextVideo(null)}
                />
              )}

              {/* YouTube IFrame Player */}
              <YouTubePlayer
                key={effectiveVideoId}
                videoId={effectiveVideoId}
                initialTimeSeconds={initialTime}
                onVideoEnded={handleVideoEnded}
                onTimeUpdate={handleTimeUpdate}
                onPlayerReady={(player) => {
                  playerInstanceRef.current = player;
                }}
                autoPlay={true}
              />
            </div>

            {/* Información del Video Section */}
            <VideoInfo
              currentVideo={currentVideo}
              currentIndex={currentVideoIndex}
              totalVideos={totalCount}
              channelTitle={activeCourse.channelTitle}
              isWatched={isCurrentWatched}
              prevVideo={prevVideo}
              nextVideo={nextVideo}
              onToggleWatched={() => markVideoWatched(activeCourse.id, effectiveVideoId, !isCurrentWatched)}
              onSelectPrev={() => prevVideo && handleSelectVideo(prevVideo.videoId)}
              onSelectNext={() => nextVideo && handleSelectVideo(nextVideo.videoId)}
            />
          </div>

          {/* Right Column (Notas [Top] + Lista de Clases [Bottom]) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            {/* Notas Section (Top Right) */}
            <div className="w-full">
              <CourseNotes
                courseTitle={activeCourse.title}
                videoId={effectiveVideoId}
                videoTitle={currentVideo?.title || ''}
                videoNotes={currentVideoNotes}
                overallCourseNotes={overallNotes}
                currentVideoTimeSeconds={currentVideoTime}
                onSaveVideoNotes={(vid, notes) => saveVideoNote(activeCourse.id, vid, notes)}
                onSaveCourseNotes={(notes) => saveCourseNote(activeCourse.id, notes)}
                onSeekToTime={handleSeekToTime}
              />
            </div>

            {/* Lista de Clases Section (Bottom Right) */}
            <div className="w-full">
              <CourseSidebar
                videos={videos}
                activeVideoId={effectiveVideoId}
                progress={activeCourseProgress}
                onSelectVideo={(vid) => handleSelectVideo(vid)}
                onToggleWatched={(vid, watched) => markVideoWatched(activeCourse.id, vid, watched)}
                onAddLesson={() => setIsAddLessonOpen(true)}
                onDeleteLesson={(itemId) => removeVideoFromCourse(activeCourse.id, itemId)}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Add Lesson Modal */}
      <AddLessonModal
        isOpen={isAddLessonOpen}
        onClose={() => setIsAddLessonOpen(false)}
        onAddLesson={async (videoUrl, customTitle) => {
          await addVideoToCourse(activeCourse.id, videoUrl, customTitle);
        }}
      />
    </div>
  );
};
