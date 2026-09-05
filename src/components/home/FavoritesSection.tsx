import React from 'react';
import { Star } from 'lucide-react';
import type { Course, CourseProgress } from '../../types/course';
import { CourseCard } from './CourseCard';

interface FavoritesSectionProps {
  favoriteCourses: Course[];
  allProgress: Record<string, CourseProgress>;
  onSelectCourse: (courseId: string) => void;
  onToggleFavorite: (courseId: string) => void;
  onDeleteCourse: (courseId: string) => void;
  isSignedIn: boolean;
}

export const FavoritesSection: React.FC<FavoritesSectionProps> = ({
  favoriteCourses,
  allProgress,
  onSelectCourse,
  onToggleFavorite,
  onDeleteCourse,
  isSignedIn,
}) => {
  if (favoriteCourses.length === 0) return null;

  return (
    <section className="mb-10 animate-in fade-in duration-300">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-amber-400/20 text-amber-600 flex items-center justify-center">
          <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-fg tracking-tight flex items-center gap-2">
            Cursos Favoritos
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
              {favoriteCourses.length}
            </span>
          </h2>
          <p className="text-xs text-fg-muted">Tus cursos destacados para acceso rápido</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {favoriteCourses.map((course) => (
          <CourseCard
            key={`fav_${course.id}`}
            course={course}
            progress={allProgress[course.id]}
            onSelect={onSelectCourse}
            onToggleFavorite={onToggleFavorite}
            onDelete={onDeleteCourse}
            isSignedIn={isSignedIn}
          />
        ))}
      </div>
    </section>
  );
};
