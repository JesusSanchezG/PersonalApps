-- ============================================================
--  CursosTube - Esquema Supabase
--  Ejecuta este archivo en: Supabase Dashboard -> SQL Editor
--
--  Compatible con el proyecto kaulvejowumizovgdhbs.supabase.co.
--  Si ya existía un esquema anterior (por ejemplo el de
--  "CourseHub": courses/videos/video_progress), se elimina y
--  se crea el de CursosTube. Idempotente: se puede re-ejecutar.
-- ============================================================

-- ------------------------------------------------------------
-- 0) Limpiar esquemas previos (cualquier versión) en orden
--    por dependencias. Sin pérdida de datos relevantes.
-- ------------------------------------------------------------
drop table if exists public.course_notes   cascade;
drop table if exists public.user_progress  cascade;
drop table if exists public.video_progress cascade;
drop table if exists public.videos         cascade;
drop table if exists public.courses        cascade;

-- ------------------------------------------------------------
-- 1. Tabla de cursos (los videos se guardan como JSONB)
-- ------------------------------------------------------------
create table if not exists public.courses (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  local_id               text not null,                -- id local del dispositivo (localStorage)
  youtube_url            text not null default '',
  type                   text not null default 'playlist' check (type in ('playlist','single-video')),
  playlist_id            text,
  title                  text not null default '',
  channel_title          text,
  description            text,
  thumbnail_url          text not null default '',
  is_favorite            boolean not null default false,
  videos                 jsonb not null default '[]'::jsonb,
  last_played_video_id   text,
  last_played_timestamp  bigint not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (user_id, local_id)
);

-- ------------------------------------------------------------
-- 2. Progreso por video (visto, posición, notas de la lección)
-- ------------------------------------------------------------
create table if not exists public.video_progress (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  course_id             uuid not null references public.courses(id) on delete cascade,
  video_id              text not null,
  watched               boolean not null default false,
  completed_at          timestamptz,
  last_position_seconds bigint not null default 0,
  notes                 text not null default '',
  updated_at            timestamptz not null default now(),
  unique (user_id, course_id, video_id)
);

-- ------------------------------------------------------------
-- 3. Notas generales del curso
-- ------------------------------------------------------------
create table if not exists public.course_notes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  course_id     uuid not null references public.courses(id) on delete cascade,
  overall_notes text not null default '',
  updated_at    timestamptz not null default now(),
  unique (user_id, course_id)
);

-- ------------------------------------------------------------
-- 4. Row Level Security: cada usuario solo ve/edita lo suyo
-- ------------------------------------------------------------
alter table public.courses       enable row level security;
alter table public.video_progress enable row level security;
alter table public.course_notes  enable row level security;

drop policy if exists "courses_own"       on public.courses;
drop policy if exists "video_progress_own" on public.video_progress;
drop policy if exists "course_notes_own"  on public.course_notes;

create policy "courses_own"
  on public.courses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "video_progress_own"
  on public.video_progress for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "course_notes_own"
  on public.course_notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 5. Índices de consulta
-- ------------------------------------------------------------
create index if not exists courses_user_id_idx        on public.courses(user_id);
create index if not exists video_progress_course_idx  on public.video_progress(course_id);
create index if not exists course_notes_course_idx    on public.course_notes(course_id);