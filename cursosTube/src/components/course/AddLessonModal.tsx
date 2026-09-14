import React, { useState } from 'react';
import { Loader2, AlertCircle, Plus } from 'lucide-react';
import { Modal } from '../common/Modal';
import { parseYouTubeUrl } from '../../services/youtube';

interface AddLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddLesson: (videoUrl: string, customTitle?: string) => Promise<void>;
}

export const AddLessonModal: React.FC<AddLessonModalProps> = ({
  isOpen,
  onClose,
  onAddLesson,
}) => {
  const [url, setUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = parseYouTubeUrl(url);
    if (!parsed.isValid || !parsed.videoId) {
      setError('Por favor introduce un enlace de video de YouTube válido.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddLesson(url, customTitle.trim() || undefined);
      setUrl('');
      setCustomTitle('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al añadir la lección.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Añadir video a este curso"
      subtitle="Agrega una nueva lección al temario"
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-fg uppercase tracking-wider mb-1">
            URL del Video de YouTube
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
              <svg className="w-4 h-4 text-red-600 fill-current" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface border border-line focus:border-fg text-xs text-fg outline-none"
              autoFocus
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-fg uppercase tracking-wider mb-1">
            Título de la lección (opcional)
          </label>
          <input
            type="text"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="Ej: Clase 2: Hooks avanzados"
            className="w-full px-3 py-2 rounded-xl bg-surface border border-line focus:border-fg text-xs text-fg outline-none"
          />
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-red-50 text-red-800 text-xs border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-fg-soft hover:bg-surface-2"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !url.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-btn hover:bg-btn-hover text-white text-xs font-semibold disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5 text-sky-300" />
            )}
            <span>Añadir Lección</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
