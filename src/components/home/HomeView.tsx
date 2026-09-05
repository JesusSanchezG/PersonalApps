import React, { useState, useMemo, Suspense, lazy } from 'react';
import { useCourseContext } from '../../context/CourseContext';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from '../common/Navbar';
import { WelcomeHero } from './WelcomeHero';
import { FavoritesSection } from './FavoritesSection';
import { CourseCard } from './CourseCard';
import { EmptyMockupState } from './EmptyMockupState';
import { AddCourseModal } from './AddCourseModal';
import { SettingsModal } from './SettingsModal';
import { Search, BookOpen, AlertCircle, RefreshCw, Cloud, LogIn } from 'lucide-react';

// Code-splitting: el modal de auth (y supabase-js) solo se carga al abrirlo
const AuthModal = lazy(() =>
  import('../auth/AuthModal').then((m) => ({ default: m.AuthModal }))
);

export const HomeView: React.FC = () => {
  const {
    courses,
    allProgress,
    settings,
    addCourse,
    deleteCourse,
    toggleFavorite,
    setActiveCourse,
    updateSettings,
    isSyncing,
    isSignedIn,
    refreshSync,
    lastSyncError,
    lastSyncAt,
    remoteStats
  } = useCourseContext();

  const { user, isAuthLoading, isSupabaseConfigured, signOut } = useAuth();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'in-progress' | 'completed'>('all');

  // Favorites
  const favoriteCourses = useMemo(() => {
    return courses.filter(c => c.isFavorite);
  }, [courses]);

  // Filtered courses for main list
  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
      // Search match
      const matchesSearch = 
        course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (course.channelTitle && course.channelTitle.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // Filter status
      const prog = allProgress[course.id];
      const isCompleted = prog?.isCourseCompleted || (prog?.completedVideosCount === course.videos.length && course.videos.length > 0);

      if (filterType === 'completed') return isCompleted;
      if (filterType === 'in-progress') return !isCompleted;
      return true;
    });
  }, [courses, allProgress, searchQuery, filterType]);

  // Sample course loader helper
  const handleLoadSample = async (type: 'react' | 'python' | 'english') => {
    const samples = {
      react: 'https://www.youtube.com/watch?v=6Jfk8n3ghcQ',
      python: 'https://www.youtube.com/watch?v=nKPbfIU442g',
      english: 'https://www.youtube.com/watch?v=JUpt7O57gVw',
    };
    try {
      await addCourse(samples[type]);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-page text-fg flex flex-col font-sans selection:bg-btn selection:text-white">
      {/* Top Navigation */}
      <Navbar
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        totalCoursesCount={courses.length}
        onLogoClick={() => {}}
        user={user}
        isAuthLoading={isAuthLoading}
        isSyncing={isSyncing}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onSignOut={async () => {
          await signOut();
        }}
        onRefreshSync={() => {
          refreshSync();
        }}
      />

      {/* Nota informativa cuando Supabase no está configurado */}
      {!isSupabaseConfigured && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2 text-xs text-amber-800">
            La sincronización en la nube no está disponible (falta configurar Supabase en el archivo .env). La app sigue funcionando con almacenamiento local.
          </div>
        </div>
      )}

      {/* Aviso: hay cursos locales sin sesión (no se suben a la nube) */}
      {!isSignedIn && courses.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-800 flex items-start justify-between gap-3">
            <span className="flex items-start gap-2">
              <Cloud className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Tienes <strong>{courses.length}</strong> {courses.length === 1 ? 'curso guardado' : 'cursos guardados'}{' '}
                solo en este dispositivo. Inicia sesión para sincronizarlos con tus otros dispositivos.
              </span>
            </span>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-btn hover:bg-btn-hover text-white font-semibold transition-colors"
            >
              <LogIn className="w-3 h-3" />
              Iniciar sesión
            </button>
          </div>
        </div>
      )}

      {/* Error de sincronización visible (si el sync con la nube falló) */}
      {isSignedIn && lastSyncError && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-xs text-red-800 flex items-start justify-between gap-3">
            <span className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              {lastSyncError}
            </span>
            <button
              onClick={() => refreshSync()}
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Welcome Hero Banner */}
        <WelcomeHero
          onAddCourseClick={() => setIsAddModalOpen(true)}
          hasCourses={courses.length > 0}
        />

        {courses.length === 0 ? (
          /* Empty Mockup State: Shown only when user has 0 courses */
          <EmptyMockupState
            onAddCourseClick={() => setIsAddModalOpen(true)}
            onLoadSampleCourse={handleLoadSample}
          />
        ) : (
          /* Real Courses View: Rendered once the user adds their first course */
          <div className="space-y-10 animate-in fade-in duration-300">
            {/* 1. Favorites Section */}
            <FavoritesSection
              favoriteCourses={favoriteCourses}
              allProgress={allProgress}
              onSelectCourse={(id) => setActiveCourse(id)}
              onToggleFavorite={toggleFavorite}
              onDeleteCourse={deleteCourse}
              isSignedIn={isSignedIn}
            />

            {/* 2. All Courses Section */}
            <section>
              {/* Header with Search and Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-fg tracking-tight flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-sky-800" />
                    <span>Mis Cursos</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-2 text-fg-soft">
                      {courses.length}
                    </span>
                  </h2>
                  <p className="text-xs text-fg-muted">Selecciona un curso para continuar donde lo dejaste</p>
                </div>

                {/* Filters and Search Bar */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  {/* Search Input */}
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-4 h-4 text-fg-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar en mis cursos..."
                      className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-surface border border-line focus:border-fg text-xs text-fg placeholder-fg-muted outline-none transition-all"
                    />
                  </div>

                  {/* Filter Pills */}
                  <div className="inline-flex rounded-xl bg-surface p-0.5 border border-line text-xs">
                    <button
                      onClick={() => setFilterType('all')}
                      className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                        filterType === 'all'
                          ? 'bg-btn text-white shadow-xs'
                          : 'text-fg-soft hover:text-fg'
                      }`}
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => setFilterType('in-progress')}
                      className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                        filterType === 'in-progress'
                          ? 'bg-btn text-white shadow-xs'
                          : 'text-fg-soft hover:text-fg'
                      }`}
                    >
                      En Curso
                    </button>
                    <button
                      onClick={() => setFilterType('completed')}
                      className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                        filterType === 'completed'
                          ? 'bg-btn text-white shadow-xs'
                          : 'text-fg-soft hover:text-fg'
                      }`}
                    >
                      Completados
                    </button>
                  </div>
                </div>
              </div>

              {/* Course Cards Grid */}
              {filteredCourses.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredCourses.map((course) => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      progress={allProgress[course.id]}
                      onSelect={(id) => setActiveCourse(id)}
                      onToggleFavorite={toggleFavorite}
                      onDelete={deleteCourse}
                      isSignedIn={isSignedIn}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center rounded-2xl bg-surface border border-line">
                  <p className="text-xs text-fg-muted">
                    No se encontraron cursos que coincidan con los filtros de búsqueda.
                  </p>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* Modals */}
      <AddCourseModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddCourse={addCourse}
        apiKey={settings.youtubeApiKey}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        user={user}
        isSignedIn={isSignedIn}
        onSignOut={async () => {
          await signOut();
        }}
        onOpenAuthModal={() => {
          setIsSettingsModalOpen(false);
          setIsAuthModalOpen(true);
        }}
        lastSyncError={lastSyncError}
        lastSyncAt={lastSyncAt}
        remoteStats={remoteStats}
      />

      <Suspense fallback={null}>
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        />
      </Suspense>

      {/* Footer */}
      <footer className="mt-16 border-t border-line py-6 text-center text-xs text-fg-muted">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>CursosTube &bull; Diseñado para aprender en YouTube sin distracciones</span>
          <span>{isSignedIn ? 'Datos sincronizados en la nube' : 'Almacenamiento 100% privado en tu navegador'}</span>
        </div>
      </footer>
    </div>
  );
};
