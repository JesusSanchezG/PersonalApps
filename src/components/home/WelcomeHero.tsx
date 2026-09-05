import React from 'react';
import { PlayCircle, CheckCircle2, FileEdit, Sparkles, Plus } from 'lucide-react';

interface WelcomeHeroProps {
  onAddCourseClick: () => void;
  hasCourses: boolean;
}

export const WelcomeHero: React.FC<WelcomeHeroProps> = ({ onAddCourseClick, hasCourses }) => {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-900 via-navy-850 to-navy-800 text-white p-6 sm:p-10 shadow-lg border border-navy-700 mb-10">
      {/* Subtle decorative background glow */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-medium text-sky-200 mb-4">
          <Sparkles className="w-3.5 h-3.5 text-sky-300" />
          <span>Tu plataforma de estudio con YouTube</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white mb-3 leading-tight">
          Aprende a tu ritmo, guarda tu progreso y toma notas
        </h1>

        <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-6 max-w-2xl">
          Convierte cualquier lista de reproducción o video largo de YouTube en un curso estructurado estilo Udemy: con checkpoints automáticos, reproducción continua y espacio para tus apuntes.
        </p>

        {/* Feature badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 pt-2 border-t border-white/10">
          <div className="flex items-center gap-2.5 text-xs text-slate-200">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <span>Marcado automático en verde</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-200">
            <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-300 flex items-center justify-center shrink-0">
              <PlayCircle className="w-3.5 h-3.5" />
            </div>
            <span>Autoplay con espera de 1s</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-200">
            <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
              <FileEdit className="w-3.5 h-3.5" />
            </div>
            <span>Apuntes con timestamps</span>
          </div>
        </div>

        {!hasCourses && (
          <button
            onClick={onAddCourseClick}
            className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl bg-white text-fg font-semibold text-sm hover:bg-sky-50 transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4 text-fg" />
            <span>Añadir mi primer curso</span>
          </button>
        )}
      </div>
    </div>
  );
};
