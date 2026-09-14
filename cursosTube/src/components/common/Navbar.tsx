import React, { useState } from 'react';
import { Plus, Settings, BookOpen, Layers, LogIn, LogOut, Cloud, Loader2, RefreshCw, Sun, Moon } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { getInitialTheme, toggleTheme, type Theme } from '../../services/theme';

interface NavbarProps {
  onOpenAddModal: () => void;
  onOpenSettingsModal: () => void;
  totalCoursesCount: number;
  onLogoClick: () => void;
  user: User | null;
  isAuthLoading: boolean;
  isSyncing: boolean;
  onOpenAuthModal: () => void;
  onSignOut: () => void;
  onRefreshSync: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAddModal,
  onOpenSettingsModal,
  totalCoursesCount,
  onLogoClick,
  user,
  isAuthLoading,
  isSyncing,
  onOpenAuthModal,
  onSignOut,
  onRefreshSync,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [theme, setTheme] = useState<Theme>(getInitialTheme());

  const handleToggleTheme = () => {
    setTheme((current) => toggleTheme(current));
  };

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : '';

  return (
    <header className="sticky top-0 z-30 bg-page/90 backdrop-blur-md border-b border-line transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <button
          onClick={onLogoClick}
          className="flex items-center gap-3 group focus:outline-none text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-btn flex items-center justify-center text-white shadow-sm group-hover:bg-btn-hover transition-colors">
            <BookOpen className="w-5 h-5 text-sky-300 group-hover:scale-105 transition-transform" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg tracking-tight text-fg">
                Cursos<span className="text-sky-700 font-light">Tube</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-surface-2 text-fg-soft border border-line">
                Lite
              </span>
            </div>
            <p className="text-xs text-fg-muted hidden sm:block">
              Tu campus de YouTube sin distracciones
            </p>
          </div>
        </button>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Sync indicator + manual refresh */}
          {user && (
            <button
              onClick={onRefreshSync}
              disabled={isSyncing}
              className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                isSyncing
                  ? 'bg-sky-50 border border-sky-200 text-sky-800 cursor-default'
                  : 'bg-surface border border-line text-fg-soft hover:bg-surface-2 hover:text-fg'
              }`}
              title="Sincronizar ahora con la nube"
            >
              {isSyncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
            </button>
          )}

          {totalCoursesCount > 0 && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 border border-line text-xs font-medium text-fg-soft">
              <Layers className="w-3.5 h-3.5 text-sky-700" />
              <span>{totalCoursesCount} {totalCoursesCount === 1 ? 'curso' : 'cursos'}</span>
            </div>
          )}

          {/* User / Auth */}
          {!isAuthLoading && (
            user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(v => !v)}
                  className="flex items-center gap-2 p-1.5 rounded-xl bg-surface border border-line hover:bg-surface-2 transition-colors"
                  title={user.email || 'Cuenta'}
                >
                  <div className="w-7 h-7 rounded-lg bg-btn text-sky-300 flex items-center justify-center text-xs font-bold">
                    {initials}
                  </div>
                  <Cloud className="w-3.5 h-3.5 text-emerald-600 hidden sm:block" />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl bg-page border border-line shadow-xl py-1.5 z-20 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-2 border-b border-line">
                      <p className="text-[11px] font-bold text-fg truncate">
                        {user.user_metadata?.display_name || 'Usuario'}
                      </p>
                      <p className="text-[11px] text-fg-muted truncate">{user.email}</p>
                      <p className="text-[10px] text-emerald-700 mt-0.5 flex items-center gap-1">
                        <Cloud className="w-2.5 h-2.5" />
                        Sincronizado en la nube
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onSignOut();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-fg-soft hover:text-red-700 hover:bg-red-50 font-medium transition-colors text-left"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={onOpenAuthModal}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface hover:bg-surface-2 border border-line text-xs font-semibold text-fg transition-colors"
                title="Inicia sesión para sincronizar tus cursos entre dispositivos"
              >
                <LogIn className="w-4 h-4 text-sky-700" />
                <span className="hidden sm:inline">Iniciar sesión</span>
              </button>
            )
          )}

          {/* Theme Toggle */}
          <button
            onClick={handleToggleTheme}
            title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="p-2 rounded-xl text-fg-soft hover:text-fg hover:bg-surface-2 border border-transparent hover:border-line transition-colors focus:outline-none"
          >
            {theme === 'dark' ? (
              <Moon className="w-5 h-5" />
            ) : (
              <Sun className="w-5 h-5" />
            )}
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettingsModal}
            title="Ajustes y copia de seguridad"
            className="p-2 rounded-xl text-fg-soft hover:text-fg hover:bg-surface-2 border border-transparent hover:border-line transition-colors focus:outline-none"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Add Course Primary CTA */}
          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-btn text-white text-sm font-medium hover:bg-btn-hover active:scale-[0.98] transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-fg/30"
          >
            <Plus className="w-4 h-4 text-sky-300" />
            <span className="hidden xs:inline">Añadir Curso</span>
            <span className="xs:hidden">Añadir</span>
          </button>
        </div>
      </div>
    </header>
  );
};
