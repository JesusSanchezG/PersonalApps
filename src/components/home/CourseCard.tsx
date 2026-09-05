import React, { useState } from 'react';
import { Play, Star, Trash2, CheckCircle2, Clock, Video, MoreVertical, Cloud } from 'lucide-react';
import type { Course, CourseProgress } from '../../types/course';

interface CourseCardProps {
  course: Course;
  progress?: CourseProgress;
  onSelect: (courseId: string) => void;
  onToggleFavorite: (courseId: string) => void;
  onDelete: (courseId: string) => void;
  isSignedIn?: boolean;
}

export const CourseCard: React.FC<CourseCardProps> = ({
  course,
  progress,
  onSelect,
  onToggleFavorite,
  onDelete,
  isSignedIn = false,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const totalVideos = course.videos.length || 1;
  const completedVideos = progress?.completedVideosCount || 0;
  const progressPercent = Math.round((completedVideos / totalVideos) * 100);
  const isCompleted = progress?.isCourseCompleted || (completedVideos > 0 && completedVideos === totalVideos);

  const hasStarted = completedVideos > 0 || (course.lastPlayedTimestamp && course.lastPlayedTimestamp > 0);

  return (
    <div
      onClick={() => onSelect(course.id)}
      className="group relative flex flex-col rounded-2xl bg-surface border border-line hover:border-navy-700/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden"
    >
      {/* Thumbnail Container */}
      <div className="relative aspect-video w-full bg-btn overflow-hidden">
        <img
          src={course.thumbnailUrl}
          alt={course.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90 group-hover:opacity-100"
          loading="lazy"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-navy-900/80 via-transparent to-transparent pointer-events-none" />

        {/* Play Icon Center Hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-btn/30">
          <div className="w-12 h-12 rounded-full bg-btn text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
            <Play className="w-5 h-5 text-sky-300 ml-0.5 fill-sky-300" />
          </div>
        </div>

        {/* Top Badges & Favorite Star */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-auto">
          {/* Badge: Playlist vs Video */}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-btn/80 backdrop-blur-md text-white text-[11px] font-medium border border-white/10">
            <Video className="w-3 h-3 text-sky-300" />
            <span>{course.type === 'playlist' ? `${totalVideos} videos` : 'Video completo'}</span>
          </span>

          {/* Action Buttons: Star and Delete */}
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onToggleFavorite(course.id)}
              title={course.isFavorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
              className={`p-1.5 rounded-full backdrop-blur-md transition-all ${
                course.isFavorite
                  ? 'bg-amber-400 text-fg shadow-sm'
                  : 'bg-navy-900/60 text-white/80 hover:text-white hover:bg-navy-900/90'
              }`}
            >
              <Star className={`w-4 h-4 ${course.isFavorite ? 'fill-fg' : ''}`} />
            </button>

            {/* Menu trigger */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1.5 rounded-full bg-navy-900/60 text-white/80 hover:text-white hover:bg-navy-900/90 backdrop-blur-md transition-colors"
                title="Opciones"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMenu && (
                <div
                  className="absolute right-0 mt-1 w-36 rounded-xl bg-page border border-line shadow-xl py-1 z-20"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowDeleteConfirm(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 font-medium transition-colors text-left"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar curso</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Completion status on thumbnail */}
        {isCompleted && (
          <div className="absolute bottom-2.5 left-2.5 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[11px] font-semibold shadow-sm">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completado</span>
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <h3
            className="font-semibold text-sm text-fg line-clamp-2 mb-1 group-hover:text-sky-900 transition-colors leading-snug"
            title={course.title}
          >
            {course.title}
          </h3>

          {course.channelTitle && (
            <p className="text-xs text-fg-muted line-clamp-1 mb-3">
              {course.channelTitle}
            </p>
          )}
        </div>

        {/* Progress Bar & Footer */}
        <div className="pt-2 border-t border-line/70 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-medium text-fg-soft">
            <span>{completedVideos} de {totalVideos} videos vistos</span>
            <span className={isCompleted ? 'text-emerald-700 font-bold' : ''}>
              {progressPercent}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1.5 bg-line rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isCompleted ? 'bg-emerald-500' : 'bg-btn'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Action Link text */}
          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="text-fg-muted flex items-center gap-1.5 text-[11px]">
              <Clock className="w-3 h-3" />
              {hasStarted ? 'En progreso' : 'Sin iniciar'}
              {isSignedIn && (
                <span title="Sincronizado en la nube">
                  <Cloud className="w-3 h-3 text-emerald-600" />
                </span>
              )}
            </span>
            <span className="font-semibold text-fg group-hover:text-sky-800 flex items-center gap-1">
              {hasStarted ? 'Continuar' : 'Comenzar'} &rarr;
            </span>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Overlay */}
      {showDeleteConfirm && (
        <div
          className="absolute inset-0 bg-navy-900/90 backdrop-blur-sm z-30 p-4 flex flex-col items-center justify-center text-center text-white animate-in fade-in duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <Trash2 className="w-8 h-8 text-red-400 mb-2" />
          <p className="text-sm font-semibold mb-1">¿Eliminar este curso?</p>
          <p className="text-xs text-slate-300 mb-4 px-2">
            Se perderá el progreso y las notas guardadas de este curso.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => onDelete(course.id)}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors"
            >
              Sí, eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
