import React from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  User,
  ExternalLink
} from 'lucide-react';
import type { VideoItem } from '../../types/course';

interface VideoInfoProps {
  currentVideo: VideoItem;
  currentIndex: number;
  totalVideos: number;
  channelTitle?: string;
  isWatched: boolean;
  prevVideo: VideoItem | null;
  nextVideo: VideoItem | null;
  onToggleWatched: () => void;
  onSelectPrev: () => void;
  onSelectNext: () => void;
}

export const VideoInfo: React.FC<VideoInfoProps> = ({
  currentVideo,
  currentIndex,
  totalVideos,
  channelTitle,
  isWatched,
  prevVideo,
  nextVideo,
  onToggleWatched,
  onSelectPrev,
  onSelectNext,
}) => {
  return (
    <div className="rounded-2xl bg-surface border border-line p-4 sm:p-5 shadow-sm transition-all">
      {/* Top row: Badges & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Lesson Index & Title */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-btn text-white">
              Lección {currentIndex + 1} de {totalVideos}
            </span>

            {isWatched ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 fill-emerald-600 text-white" />
                <span>Completada</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-fg-muted bg-surface-2 px-2 py-0.5 rounded-md">
                <span>En progreso</span>
              </span>
            )}

            {channelTitle && (
              <span className="text-xs text-fg-muted flex items-center gap-1 truncate">
                <User className="w-3 h-3 text-fg-muted" />
                {channelTitle}
              </span>
            )}
          </div>

          <h2 className="text-base sm:text-lg font-bold text-fg leading-snug">
            {currentVideo.title}
          </h2>
        </div>

        {/* Right: Watched Toggle & Navigation Buttons */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
          {/* Previous Lesson */}
          <button
            onClick={onSelectPrev}
            disabled={!prevVideo}
            className="p-2 rounded-xl bg-surface-2 hover:bg-line disabled:opacity-30 disabled:pointer-events-none text-fg transition-colors"
            title={prevVideo ? `Anterior: ${prevVideo.title}` : 'No hay lección anterior'}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Mark as watched toggle button */}
          <button
            onClick={onToggleWatched}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs active:scale-98 ${
              isWatched
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-btn text-white hover:bg-btn-hover'
            }`}
          >
            <CheckCircle2
              className={`w-4 h-4 ${isWatched ? 'fill-white text-emerald-600' : 'text-sky-300'}`}
            />
            <span>{isWatched ? 'Completada' : 'Marcar como vista'}</span>
          </button>

          {/* Next Lesson */}
          <button
            onClick={onSelectNext}
            disabled={!nextVideo}
            className="p-2 rounded-xl bg-surface-2 hover:bg-line disabled:opacity-30 disabled:pointer-events-none text-fg transition-colors"
            title={nextVideo ? `Siguiente: ${nextVideo.title}` : 'No hay siguiente lección'}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* YouTube Direct Link */}
      <div className="mt-3 pt-3 border-t border-line/70 flex items-center justify-between text-xs text-fg-muted">
        <div className="flex items-center gap-2">
          <span className="text-[11px]">Progreso guardado automáticamente al finalizar</span>
        </div>
        <a
          href={`https://www.youtube.com/watch?v=${currentVideo.videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-800 hover:text-sky-950 hover:underline"
        >
          <span>Abrir en YouTube</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};
