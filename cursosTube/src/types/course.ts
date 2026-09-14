export interface VideoItem {
  id: string;
  videoId: string;
  title: string;
  duration?: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
  order: number;
}

export interface Course {
  id: string;
  youtubeUrl: string;
  type: 'playlist' | 'single-video';
  playlistId?: string;
  title: string;
  channelTitle?: string;
  description?: string;
  thumbnailUrl: string;
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
  lastPlayedVideoId?: string;
  lastPlayedTimestamp?: number;
  videos: VideoItem[];
}

export interface VideoProgress {
  videoId: string;
  watched: boolean;
  completedAt?: number;
  lastPositionSeconds: number;
  durationSeconds?: number;
  notes: string;
  updatedAt?: number;
}

export interface CourseProgress {
  courseId: string;
  completedVideosCount: number;
  totalVideosCount: number;
  isCourseCompleted: boolean;
  overallNotes: string;
  videoProgress: Record<string, VideoProgress>; // videoId -> VideoProgress
  updatedAt?: number;
}

export interface UserSettings {
  youtubeApiKey?: string;
  autoPlayNext: boolean;
  autoPlayDelaySeconds: number;
  playbackSpeed: number;
  saveIntervalSeconds: number;
}
