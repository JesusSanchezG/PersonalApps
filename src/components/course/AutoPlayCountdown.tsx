import React, { useEffect, useState } from 'react';
import { CheckCircle2, FastForward } from 'lucide-react';
import type { VideoItem } from '../../types/course';

interface AutoPlayCountdownProps {
  nextVideo: VideoItem;
  delaySeconds: number;
  onPlayNext: () => void;
  onCancel: () => void;
}

export const AutoPlayCountdown: React.FC<AutoPlayCountdownProps> = ({
  nextVideo,
  delaySeconds = 1,
  onPlayNext,
  onCancel,
}) => {
  const [timeLeft, setTimeLeft] = useState(delaySeconds);

  useEffect(() => {
    setTimeLeft(delaySeconds);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onPlayNext();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [delaySeconds, onPlayNext]);

  return (
    <div className="rounded-2xl bg-gradient-to-r from-navy-900 via-navy-850 to-navy-800 text-white p-4 shadow-xl border border-sky-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-top duration-200">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              ¡Lección completada!
            </span>
            <span className="text-xs text-sky-200">
              &bull; Siguiente en {timeLeft}s
            </span>
          </div>
          <p className="text-xs sm:text-sm font-semibold text-white line-clamp-1">
            {nextVideo.title}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-slate-200 transition-colors"
        >
          Pausar aquí
        </button>
        <button
          onClick={onPlayNext}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-fg text-xs font-bold transition-all shadow-sm active:scale-95"
        >
          <FastForward className="w-4 h-4 fill-current" />
          <span>Siguiente ahora</span>
        </button>
      </div>
    </div>
  );
};
