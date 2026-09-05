import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Play,
  Search,
  Plus,
  Trash2,
  ListVideo,
  Clock
} from 'lucide-react';
import type { VideoItem, CourseProgress } from '../../types/course';

interface CourseSidebarProps {
  videos: VideoItem[];
  activeVideoId: string | null;
  progress: CourseProgress | null;
  onSelectVideo: (videoId: string) => void;
  onToggleWatched: (videoId: string, watched: boolean) => void;
  onAddLesson: () => void;
  onDeleteLesson?: (videoItemId: string) => void;
}

export const CourseSidebar: React.FC<CourseSidebarProps> = ({
  videos,
  activeVideoId,
  progress,
  onSelectVideo,
  onToggleWatched,
  onAddLesson,
  onDeleteLesson,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const completedCount = useMemo(() => {
    if (!progress) return 0;
    return Object.values(progress.videoProgress).filter((p) => p.watched).length;
  }, [progress]);

  const totalVideos = videos.length;
  const progressPercent = totalVideos > 0 ? Math.round((completedCount / totalVideos) * 100) : 0;

  const filteredVideos = useMemo(() => {
    if (!searchQuery.trim()) return videos;
    return videos.filter((v) =>
      v.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [videos, searchQuery]);

  return (
    <div className="flex flex-col rounded-2xl bg-surface border border-line shadow-sm overflow-hidden h-full">
      {/* Header */}
      <div className="p-3.5 border-b border-line bg-surface-2/70 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-xs text-fg">
            <ListVideo className="w-3.5 h-3.5 text-sky-800" />
            <span>Lista de Clases</span>
          </div>

          <button
            onClick={onAddLesson}
            className="px-2 py-1 rounded-lg bg-btn hover:bg-btn-hover text-white text-[11px] font-semibold flex items-center gap-1 transition-all shadow-xs active:scale-95"
            title="Añadir video a este curso"
          >
            <Plus className="w-3 h-3 text-sky-300" />
            <span>Añadir</span>
          </button>
        </div>

        {/* Progress summary bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-fg-soft">
            <span>{completedCount} de {totalVideos} completadas</span>
            <span className={completedCount === totalVideos && totalVideos > 0 ? 'text-emerald-700 font-bold' : 'text-fg'}>
              {progressPercent}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-line rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                completedCount === totalVideos && totalVideos > 0 ? 'bg-emerald-500' : 'bg-btn'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Filter search if more than 3 videos */}
        {videos.length > 3 && (
          <div className="relative">
            <Search className="w-3 h-3 text-fg-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar clase..."
              className="w-full pl-7 pr-2.5 py-1 text-[11px] rounded-lg bg-page border border-line focus:border-fg text-fg placeholder-fg-muted outline-none transition-all"
            />
          </div>
        )}
      </div>

      {/* Classes List */}
      <div className="flex-1 overflow-y-auto divide-y divide-line/60 max-h-[260px] lg:max-h-[320px]">
        {filteredVideos.map((video, index) => {
          const isActive = video.videoId === activeVideoId;
          const isWatched = progress?.videoProgress[video.videoId]?.watched || false;

          return (
            <div
              key={video.id || `${video.videoId}_${index}`}
              onClick={() => onSelectVideo(video.videoId)}
              className={`group flex items-start gap-2.5 p-3 cursor-pointer transition-all ${
                isActive
                  ? 'bg-line border-l-4 border-l-fg shadow-xs'
                  : 'hover:bg-surface-2'
              }`}
            >
              {/* Green Dot Indicator (Automatic / Toggleable) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleWatched(video.videoId, !isWatched);
                }}
                title={isWatched ? 'Completada (clic para desmarcar)' : 'Marcar como completada'}
                className="mt-0.5 shrink-0 p-0.5 rounded-full hover:scale-110 transition-transform focus:outline-none"
              >
                {isWatched ? (
                  /* Green dot filled badge */
                  <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 fill-emerald-500 text-white" />
                  </div>
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-line-strong group-hover:border-line-strong flex items-center justify-center transition-colors">
                    <span className="w-1 h-1 rounded-full bg-transparent group-hover:bg-line-strong" />
                  </div>
                )}
              </button>

              {/* Lesson Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] font-mono font-bold text-fg-muted">
                    {String(video.order || index + 1).padStart(2, '0')}
                  </span>
                  {isActive && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-sky-800 uppercase tracking-wider bg-sky-100 px-1 py-0.2 rounded border border-sky-200">
                      <Play className="w-2 h-2 fill-current" />
                      Actual
                    </span>
                  )}
                </div>

                <h4
                  className={`text-xs font-medium leading-snug line-clamp-2 ${
                    isActive ? 'text-fg font-semibold' : 'text-fg'
                  }`}
                >
                  {video.title}
                </h4>

                {video.duration && (
                  <div className="flex items-center gap-1 text-[10px] text-fg-muted mt-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{video.duration}</span>
                  </div>
                )}
              </div>

              {/* Optional Delete single item */}
              {onDeleteLesson && videos.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`¿Quitar "${video.title}" de este curso?`)) {
                      onDeleteLesson(video.id || video.videoId);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-fg-muted hover:text-red-600 transition-opacity"
                  title="Quitar de la lista"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        {filteredVideos.length === 0 && (
          <div className="p-4 text-center text-xs text-fg-muted">
            No hay lecciones que coincidan.
          </div>
        )}
      </div>
    </div>
  );
};
