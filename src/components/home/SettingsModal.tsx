import React, { useState } from 'react';
import { Key, Play, Download, Upload, Check, AlertCircle, ShieldCheck, Cloud, LogIn, LogOut, Loader2, Activity } from 'lucide-react';
import { Modal } from '../common/Modal';
import type { UserSettings } from '../../types/course';
import { getAllProgress, getSavedCourses, saveCourses, saveAllProgress } from '../../services/storage';
import { testCloudConnection, type CloudTestResult } from '../../services/sync';
import type { User } from '@supabase/supabase-js';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  user: User | null;
  isSignedIn: boolean;
  onSignOut: () => Promise<void>;
  onOpenAuthModal: () => void;
  lastSyncError: string | null;
  lastSyncAt: number | null;
  remoteStats: { courses: number; progress: number; error: string | null };
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  user,
  isSignedIn,
  onSignOut,
  onOpenAuthModal,
  lastSyncError,
  lastSyncAt,
  remoteStats,
}) => {
  const [apiKey, setApiKey] = useState(settings.youtubeApiKey || '');
  const [autoPlayNext, setAutoPlayNext] = useState(settings.autoPlayNext);
  const [autoPlayDelaySeconds, setAutoPlayDelaySeconds] = useState(settings.autoPlayDelaySeconds || 1);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<CloudTestResult | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      youtubeApiKey: apiKey.trim() || undefined,
      autoPlayNext,
      autoPlayDelaySeconds: Number(autoPlayDelaySeconds) || 1,
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  // Export JSON backup
  const handleExportBackup = () => {
    const backupData = {
      courses: getSavedCourses(),
      progress: getAllProgress(),
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cursos_youtube_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON backup
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);

        if (Array.isArray(data.courses) && data.progress) {
          saveCourses(data.courses);
          saveAllProgress(data.progress);
          setImportMessage({
            type: 'success',
            text: `¡Copia de seguridad restaurada con éxito! Se cargaron ${data.courses.length} cursos.`
          });
          setTimeout(() => {
            window.location.reload();
          }, 1200);
        } else {
          setImportMessage({
            type: 'error',
            text: 'El archivo no tiene el formato de copia de seguridad esperado.'
          });
        }
      } catch {
        setImportMessage({
          type: 'error',
          text: 'Error al procesar el archivo JSON.'
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configuración y Almacenamiento"
      subtitle="Ajustes de reproducción, API y respaldo en tu navegador"
      maxWidth="md"
    >
      <form onSubmit={handleSave} className="space-y-6">
        {/* Account / Sync */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-fg uppercase tracking-wider flex items-center gap-1.5">
            <Cloud className="w-3.5 h-3.5 text-sky-700" />
            Cuenta y sincronización
          </h4>

          {isSignedIn ? (
            <div className="p-3 rounded-xl bg-surface border border-line">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-fg block truncate">
                    {user?.user_metadata?.display_name || 'Usuario'}
                  </span>
                  <span className="text-[11px] text-fg-muted block truncate">{user?.email}</span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await onSignOut();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-red-100 hover:text-red-700 text-xs font-medium text-fg-soft transition-colors shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Salir
                </button>
              </div>
              <p className="text-[11px] text-emerald-700 mt-2 flex items-center gap-1">
                <Check className="w-3 h-3" />
                Tus cursos, progreso y notas se sincronizan en la nube.
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-surface border border-line">
              <p className="text-[11px] text-fg-muted leading-relaxed mb-2">
                Inicia sesión para guardar tus cursos y progreso en la nube y continuar desde cualquier dispositivo.
              </p>
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-btn hover:bg-btn-hover text-white text-xs font-semibold transition-colors"
              >
                <LogIn className="w-3.5 h-3.5 text-sky-300" />
                Iniciar sesión con Google
              </button>
            </div>
          )}

          {/* Diagnóstico de sincronización (con sesión) */}
          {isSignedIn && user && (
            <div className="p-3 rounded-xl bg-surface-2/60 border border-line text-[11px] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-fg">Cuenta</span>
                <span className="text-fg-muted truncate ml-2">{user.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-fg">ID de usuario</span>
                <span className="text-fg-muted font-mono text-[10px] truncate ml-2">
                  {(user.id || '').slice(0, 8)}…
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-fg">Cursos en la nube</span>
                <span className="text-fg-muted">
                  {remoteStats.error ? (
                    <span className="text-red-700">{remoteStats.error}</span>
                  ) : (
                    `${remoteStats.courses} cursos · ${remoteStats.progress} progreso`
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-fg">Última sincronización</span>
                <span className="text-fg-muted">
                  {lastSyncError ? (
                    <span className="text-red-700">Error</span>
                  ) : lastSyncAt ? (
                    new Date(lastSyncAt).toLocaleTimeString()
                  ) : (
                    '—'
                  )}
                </span>
              </div>

              {/* Probar conexión (diagnóstico paso a paso) */}
              <button
                type="button"
                onClick={async () => {
                  setIsTesting(true);
                  setTestResult(null);
                  const result = await testCloudConnection(user.id);
                  setTestResult(result);
                  setIsTesting(false);
                }}
                disabled={isTesting}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-btn hover:bg-btn-hover text-white text-[11px] font-semibold transition-colors disabled:opacity-60"
              >
                {isTesting ? (
                  <Loader2 className="w-3 h-3 animate-spin text-sky-300" />
                ) : (
                  <Activity className="w-3 h-3 text-sky-300" />
                )}
                {isTesting ? 'Probando...' : 'Probar conexión con Supabase'}
              </button>

              {testResult && (
                <div className="space-y-1 pt-1">
                  {testResult.steps.map((s, i) => (
                    <div key={i} className="flex items-start justify-between gap-2 text-[10px]">
                      <span className="flex items-center gap-1.5 text-fg-soft font-medium">
                        {s.ok ? (
                          <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3 h-3 text-red-600 shrink-0" />
                        )}
                        {s.name}
                      </span>
                      <span className={`text-right truncate ${s.ok ? 'text-fg-muted' : 'text-red-700 font-semibold'}`}>
                        {s.detail}
                      </span>
                    </div>
                  ))}
                  <p
                    className={`pt-1 border-t border-line/70 font-semibold text-[10px] ${
                      testResult.ok ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {testResult.ok
                      ? `Todo correcto: ${testResult.coursesInCloud} curso(s) en la nube para esta cuenta`
                      : 'La conexión falló — revisa el paso marcado en rojo'}
                  </p>
                </div>
              )}

              <p className="text-[10px] text-fg-muted pt-1 border-t border-line/70">
                Si el ID de usuario difiere entre dispositivos, son cuentas distintas y los datos no se comparten.
              </p>
            </div>
          )}
        </div>

        {/* Playback Settings */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-fg uppercase tracking-wider flex items-center gap-1.5">
            <Play className="w-3.5 h-3.5 text-sky-700" />
            Reproducción y Continuidad
          </h4>

          {/* Autoplay toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-line">
            <div>
              <span className="text-xs font-semibold text-fg block">
                Reproducir siguiente lección automáticamente
              </span>
              <span className="text-[11px] text-fg-muted">
                Al terminar un video, avanza solo al siguiente
              </span>
            </div>
            <input
              type="checkbox"
              checked={autoPlayNext}
              onChange={(e) => setAutoPlayNext(e.target.checked)}
              className="w-4 h-4 accent-fg cursor-pointer"
            />
          </div>

          {/* Autoplay Delay */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-line">
            <div>
              <span className="text-xs font-semibold text-fg block">
                Tiempo de espera entre videos (segundos)
              </span>
              <span className="text-[11px] text-fg-muted">
                Espera antes de iniciar el siguiente video (defecto: 1 segundo)
              </span>
            </div>
            <input
              type="number"
              min="0"
              max="10"
              value={autoPlayDelaySeconds}
              onChange={(e) => setAutoPlayDelaySeconds(Number(e.target.value))}
              className="w-16 px-2 py-1 text-xs text-center font-semibold rounded-lg bg-page border border-line text-fg focus:outline-none focus:border-fg"
            />
          </div>
        </div>

        {/* YouTube API Key (Optional) */}
        <div className="space-y-2 pt-2 border-t border-line">
          <h4 className="text-xs font-bold text-fg uppercase tracking-wider flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-sky-700" />
            YouTube Data API v3 (Opcional)
          </h4>
          <p className="text-[11px] text-fg-muted leading-relaxed">
            La app funciona gratis sin clave API. Si añades tu clave personal de Google Cloud, podrás obtener metadatos más completos de playlists gigantes.
          </p>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full px-3 py-2 rounded-xl bg-surface border border-line focus:border-fg text-xs text-fg placeholder-fg-muted outline-none"
          />
        </div>

        {/* Backup & Restore */}
        <div className="space-y-2 pt-2 border-t border-line">
          <h4 className="text-xs font-bold text-fg uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            Copia de Seguridad (LocalStorage)
          </h4>
          <p className="text-[11px] text-fg-muted">
            Todos tus cursos, marcas de progreso y apuntes se guardan localmente en tu navegador. Puedes exportarlos en cualquier momento.
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleExportBackup}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-line border border-line text-xs font-medium text-fg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Copia (JSON)</span>
            </button>

            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-line border border-line text-xs font-medium text-fg transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Importar Copia</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </label>
          </div>

          {importMessage && (
            <div
              className={`p-2.5 rounded-lg text-xs mt-2 flex items-center gap-2 ${
                importMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {importMessage.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{importMessage.text}</span>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-line">
          <span className="text-[11px] text-fg-muted">
            {savedSuccess ? '¡Cambios guardados!' : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-fg-soft hover:text-fg hover:bg-surface-2 transition-colors"
            >
              Cerrar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-btn hover:bg-btn-hover text-white text-xs font-semibold shadow-sm transition-all"
            >
              <Check className="w-3.5 h-3.5 text-sky-300" />
              <span>Guardar Ajustes</span>
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
