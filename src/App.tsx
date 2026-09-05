import React, { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthProvider } from './context/AuthContext';
import { CourseProvider, useCourseContext } from './context/CourseContext';
import { HomeView } from './components/home/HomeView';
import './App.css';

// Code-splitting: el reproductor (curso) se carga solo al entrar a un curso
const CourseView = lazy(() =>
  import('./components/course/CourseView').then((m) => ({ default: m.CourseView }))
);

const FullPageSpinner: React.FC = () => (
  <div className="min-h-screen bg-page flex flex-col items-center justify-center gap-3">
    <div className="w-12 h-12 rounded-2xl bg-btn flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-sky-300 animate-spin" />
    </div>
    <span className="text-xs text-fg-muted font-medium">Cargando...</span>
  </div>
);

const MainApp: React.FC = () => {
  const { activeCourseId } = useCourseContext();

  return (
    <Suspense fallback={<FullPageSpinner />}>
      {activeCourseId ? <CourseView /> : <HomeView />}
    </Suspense>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <CourseProvider>
        <MainApp />
      </CourseProvider>
    </AuthProvider>
  );
}
