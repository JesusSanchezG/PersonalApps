import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, Cloud } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useAuth } from '../../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GoogleIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.95l3.66-2.85z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { signInWithGoogle } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleGoogle = async () => {
    setError(null);
    setIsSubmitting(true);
    const result = await signInWithGoogle();
    if (result.error) {
      setError(result.error);
      setIsSubmitting(false);
    }
    // En éxito el navegador redirige o cierra el popup; no hacemos nada más.
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Iniciar sesión"
      subtitle="Sincroniza tus cursos, progreso y apuntes entre dispositivos"
      maxWidth="sm"
    >
      <div className="space-y-4">
        <button
          type="button"
          onClick={handleGoogle}
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-white px-5 py-3 text-sm font-semibold text-fg shadow-sm transition-all hover:bg-card hover:border-line-strong disabled:opacity-60 active:scale-[0.99]"
        >
          {isSubmitting ? (
            <Loader2 className="h-5 w-5 animate-spin text-sky-700" />
          ) : (
            <GoogleIcon />
          )}
          {isSubmitting ? 'Redirigiendo a Google...' : 'Continuar con Google'}
        </button>

        <p className="text-center text-[11px] leading-relaxed text-fg-muted">
          Al continuar aceptas iniciar sesión con tu cuenta de Google. Tus cursos,
          progreso y notas se guardarán en la nube.
        </p>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-800 animate-in fade-in">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-line pt-2">
          <span className="flex items-center gap-1 text-[11px] text-fg-muted">
            <Cloud className="h-3 w-3 text-sky-700" />
            Supabase &bull; tus datos están protegidos
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-fg-soft transition-colors hover:bg-line hover:text-fg"
          >
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
};