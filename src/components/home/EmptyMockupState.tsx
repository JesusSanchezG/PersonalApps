import React from 'react';
import { Plus, Package } from 'lucide-react';

interface EmptyMockupStateProps {
  onAddCourseClick: () => void;
  onLoadSampleCourse?: (sampleType: 'react' | 'python' | 'english') => void;
}

export const EmptyMockupState: React.FC<EmptyMockupStateProps> = ({
  onAddCourseClick,
  onLoadSampleCourse,
}) => {
  return (
    <div className="w-full">
      {/* Section Title */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-fg tracking-tight">Mis Cursos</h2>
          <p className="text-xs text-fg-muted">Tus cursos de YouTube aparecerán aquí</p>
        </div>
      </div>

      {/* Main Mockup Placeholder Container */}
      <div className="relative border-2 border-dashed border-line-strong rounded-3xl p-8 sm:p-12 bg-surface/50 transition-all text-center">
        {/* Mockup Ghost Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 opacity-40 pointer-events-none mb-8 max-w-4xl mx-auto">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-line bg-page p-4 flex flex-col gap-3 shadow-xs"
            >
              {/* Mockup Thumbnail */}
              <div className="w-full aspect-video rounded-xl bg-surface-2 flex items-center justify-center relative overflow-hidden">
                <div className="w-10 h-10 rounded-full bg-line-strong/60 flex items-center justify-center">
                  <Package className="w-5 h-5 text-fg-muted" />
                </div>
              </div>
              {/* Mockup Title lines */}
              <div className="space-y-2 text-left">
                <div className="h-4 bg-line rounded-md w-3/4" />
                <div className="h-3 bg-surface-2 rounded-md w-1/2" />
              </div>
              {/* Mockup progress bar */}
              <div className="h-1.5 bg-line rounded-full w-full mt-2" />
            </div>
          ))}
        </div>

        {/* Central Action Card overlay */}
        <div className="max-w-md mx-auto bg-page border border-line rounded-2xl p-6 sm:p-8 shadow-md">
          {/* Generic Course Box Icon */}
          <div className="w-16 h-16 mx-auto rounded-2xl bg-btn text-white flex items-center justify-center shadow-md mb-4 group hover:scale-105 transition-transform">
            <Package className="w-8 h-8 text-sky-300" />
          </div>

          <h3 className="text-lg font-bold text-fg mb-1.5">
            Aún no has agregado ningún curso
          </h3>
          <p className="text-xs sm:text-sm text-fg-muted mb-6 leading-relaxed">
            Pega el enlace de cualquier lista de reproducción o video de YouTube para empezar tu aprendizaje estructurado.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={onAddCourseClick}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-btn text-white text-sm font-medium hover:bg-btn-hover active:scale-[0.98] transition-all shadow-sm"
            >
              <Plus className="w-4 h-4 text-sky-300" />
              <span>Añadir enlace de YouTube</span>
            </button>
          </div>

          {/* Quick sample courses for immediate testing */}
          {onLoadSampleCourse && (
            <div className="mt-6 pt-5 border-t border-line">
              <p className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider mb-2.5">
                O prueba con un ejemplo listo:
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => onLoadSampleCourse('react')}
                  className="px-2.5 py-1 rounded-lg bg-surface-2 hover:bg-line border border-line text-xs text-fg font-medium transition-colors"
                >
                  ⚡ Curso React
                </button>
                <button
                  onClick={() => onLoadSampleCourse('python')}
                  className="px-2.5 py-1 rounded-lg bg-surface-2 hover:bg-line border border-line text-xs text-fg font-medium transition-colors"
                >
                  🐍 Curso Python
                </button>
                <button
                  onClick={() => onLoadSampleCourse('english')}
                  className="px-2.5 py-1 rounded-lg bg-surface-2 hover:bg-line border border-line text-xs text-fg font-medium transition-colors"
                >
                  🎧 Curso Inglés
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
