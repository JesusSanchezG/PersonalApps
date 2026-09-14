import type { VideoItem, Course } from '../types/course';

export interface ParsedYouTubeUrl {
  isValid: boolean;
  type: 'playlist' | 'video' | 'both' | 'invalid';
  videoId: string | null;
  playlistId: string | null;
  normalizedUrl: string;
}

/**
 * Parses any YouTube URL to extract videoId and/or playlistId
 */
export function parseYouTubeUrl(rawUrl: string): ParsedYouTubeUrl {
  const url = rawUrl.trim();
  if (!url) {
    return { isValid: false, type: 'invalid', videoId: null, playlistId: null, normalizedUrl: '' };
  }

  let videoId: string | null = null;
  let playlistId: string | null = null;

  try {
    // 1. Direct ID check (if user just pasted 11 char ID or PL... ID)
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
      return {
        isValid: true,
        type: 'video',
        videoId: url,
        playlistId: null,
        normalizedUrl: `https://www.youtube.com/watch?v=${url}`
      };
    }

    if (/^(PL|UU|FL|RD|OLAK5uy_)[a-zA-Z0-9_-]+$/.test(url)) {
      return {
        isValid: true,
        type: 'playlist',
        videoId: null,
        playlistId: url,
        normalizedUrl: `https://www.youtube.com/playlist?list=${url}`
      };
    }

    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = urlObj.hostname.replace('www.', '').replace('m.', '');

    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      // Playlist ID in query params
      const listParam = urlObj.searchParams.get('list');
      if (listParam) {
        playlistId = listParam;
      }

      // Video ID in youtu.be/ID
      if (host.includes('youtu.be')) {
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0 && pathParts[0].length === 11) {
          videoId = pathParts[0];
        }
      }
      // Video ID in /watch?v=ID
      else if (urlObj.pathname === '/watch') {
        const vParam = urlObj.searchParams.get('v');
        if (vParam) {
          videoId = vParam;
        }
      }
      // Video ID in /embed/ID, /v/ID, /shorts/ID or /live/ID (directos)
      else if (
        urlObj.pathname.startsWith('/embed/') ||
        urlObj.pathname.startsWith('/v/') ||
        urlObj.pathname.startsWith('/shorts/') ||
        urlObj.pathname.startsWith('/live/')
      ) {
        const parts = urlObj.pathname.split('/').filter(Boolean);
        if (parts.length >= 2 && parts[1].length === 11) {
          videoId = parts[1];
        }
      }
    }
  } catch {
    // Regex fallbacks if URL parsing fails
    const vMatch = url.match(/(?:v=|\/embed\/|\/watch\?v=|\/shorts\/|\/live\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (vMatch) videoId = vMatch[1];

    const listMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    if (listMatch) playlistId = listMatch[1];
  }

  if (!videoId && !playlistId) {
    return { isValid: false, type: 'invalid', videoId: null, playlistId: null, normalizedUrl: url };
  }

  let type: 'playlist' | 'video' | 'both' = 'video';
  if (playlistId && videoId) {
    type = 'both';
  } else if (playlistId) {
    type = 'playlist';
  }

  return {
    isValid: true,
    type,
    videoId,
    playlistId,
    normalizedUrl: playlistId 
      ? `https://www.youtube.com/playlist?list=${playlistId}`
      : `https://www.youtube.com/watch?v=${videoId}`
  };
}

/**
 * Format ISO 8601 duration (PT1H2M3S) to human readable MM:SS or HH:MM:SS
 */
export function formatIsoDuration(isoDuration: string): { formatted: string; seconds: number } {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return { formatted: '--:--', seconds: 0 };

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  const formatted = formatSeconds(totalSeconds);

  return { formatted, seconds: totalSeconds };
}

/**
 * Format raw seconds to MM:SS or HH:MM:SS
 */
export function formatSeconds(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';

  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);

  const pad = (num: number) => num.toString().padStart(2, '0');

  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Fetch video metadata via free noembed / oEmbed (CORS safe, no API key required)
 */
export async function fetchVideoOEmbed(videoId: string): Promise<{
  title: string;
  authorName: string;
  thumbnailUrl: string;
}> {
  const urls = [
    `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`,
    `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.title) {
          return {
            title: data.title,
            authorName: data.author_name || 'YouTube Creator',
            thumbnailUrl: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
          };
        }
      }
    } catch {
      // Try next
    }
  }

  // Fallback defaults
  return {
    title: `Video de YouTube (${videoId})`,
    authorName: 'YouTube',
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  };
}

/**
 * Fetch playlist metadata using YouTube Data API v3 if API key provided,
 * or fallback to public endpoints / oEmbed.
 */
export async function fetchPlaylistData(
  playlistId: string,
  apiKey?: string
): Promise<{
  title: string;
  channelTitle: string;
  description: string;
  thumbnailUrl: string;
  videos: VideoItem[];
}> {
  // If API key is available, use YouTube Data API v3
  if (apiKey && apiKey.trim()) {
    try {
      // 1. Fetch playlist details
      const plRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${apiKey.trim()}`
      );
      const plData = await plRes.json();
      const plItem = plData.items?.[0];

      const title = plItem?.snippet?.title || `Lista de reproducción (${playlistId})`;
      const channelTitle = plItem?.snippet?.channelTitle || 'YouTube';
      const description = plItem?.snippet?.description || '';
      const thumbnailUrl = 
        plItem?.snippet?.thumbnails?.maxres?.url ||
        plItem?.snippet?.thumbnails?.high?.url ||
        plItem?.snippet?.thumbnails?.medium?.url ||
        `https://i.ytimg.com/vi/${playlistId}/hqdefault.jpg`;

      // 2. Fetch playlist items (up to 50 items per page)
      let allVideos: VideoItem[] = [];
      let nextPageToken = '';
      let pageCount = 0;

      do {
        const itemsRes = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${playlistId}&pageToken=${nextPageToken}&key=${apiKey.trim()}`
        );
        const itemsData = await itemsRes.json();

        if (itemsData.items) {
          const pageVideos: VideoItem[] = itemsData.items
            .filter((item: any) => item.snippet?.resourceId?.videoId && item.snippet?.title !== 'Private video' && item.snippet?.title !== 'Deleted video')
            .map((item: any, idx: number) => {
              const videoId = item.snippet.resourceId.videoId;
              return {
                id: `${playlistId}_${videoId}_${allVideos.length + idx}`,
                videoId,
                title: item.snippet.title,
                thumbnailUrl: 
                  item.snippet?.thumbnails?.medium?.url ||
                  item.snippet?.thumbnails?.default?.url ||
                  `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                order: allVideos.length + idx + 1
              };
            });
          allVideos = [...allVideos, ...pageVideos];
        }

        nextPageToken = itemsData.nextPageToken || '';
        pageCount++;
      } while (nextPageToken && pageCount < 3); // limit to 150 videos

      if (allVideos.length > 0) {
        return {
          title,
          channelTitle,
          description,
          thumbnailUrl: allVideos[0]?.thumbnailUrl || thumbnailUrl,
          videos: allVideos
        };
      }
    } catch (e) {
      console.warn('YouTube Data API failed, trying public fallbacks:', e);
    }
  }

  // Fallback 1: Public Invidious / Piped instances (free, no API key required).
  // A verified list of currently-responding instances (tested live):
  const invidiousInstances = [
    'https://inv.nadeko.net',
    'https://invidious.f5.si',
    'https://invidious.nerdvpn.de',
    'https://yewtu.be'
  ];

  const pipedInstances = [
    'https://api.piped.private.coffee'
  ];

  // Try Invidious instances first (best response shape: { videos: [{ videoId, title, lengthSeconds }] })
  for (const instance of invidiousInstances) {
    try {
      const res = await fetch(`${instance}/api/v1/playlists/${playlistId}`, {
        signal: AbortSignal.timeout(6000)
      });
      if (res.ok) {
        const data = await res.json();
        const title = data.title || `Curso de YouTube`;
        const channelTitle = data.author || 'YouTube';
        const rawVideos = Array.isArray(data.videos) ? data.videos : [];

        if (rawVideos.length > 0) {
          const videos: VideoItem[] = rawVideos
            .filter((v: any) => v.videoId && /^[a-zA-Z0-9_-]{11}$/.test(v.videoId))
            .map((v: any, index: number) => {
              const videoId = v.videoId;
              const durationSecs = v.lengthSeconds || 0;
              return {
                id: `${playlistId}_${videoId}_${index}`,
                videoId,
                title: v.title || `Video ${index + 1}`,
                duration: durationSecs ? formatSeconds(durationSecs) : undefined,
                durationSeconds: durationSecs,
                thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                order: index + 1
              };
            });

          if (videos.length > 0) {
            return {
              title,
              channelTitle,
              description: data.description || '',
              thumbnailUrl: `https://i.ytimg.com/vi/${videos[0].videoId}/hqdefault.jpg`,
              videos
            };
          }
        }
      }
    } catch {
      // Continue to next instance
    }
  }

  // Try Piped instances (response shape: { relatedStreams: [{ url: "/watch?v=...", title, duration }] })
  for (const instance of pipedInstances) {
    try {
      const res = await fetch(`${instance}/playlists/${playlistId}`, {
        signal: AbortSignal.timeout(6000)
      });
      if (res.ok) {
        const data = await res.json();
        const title = data.name || data.title || `Curso de YouTube`;
        const channelTitle = data.uploader || 'YouTube';
        const rawVideos = Array.isArray(data.relatedStreams) ? data.relatedStreams : [];

        if (rawVideos.length > 0) {
          const videos: VideoItem[] = rawVideos
            .map((v: any) => {
              const videoId = (v.url && v.url.includes('/watch?v=') ? v.url.split('/watch?v=')[1] : v.videoId) || '';
              return { v, videoId };
            })
            .filter(({ videoId }: any) => /^[a-zA-Z0-9_-]{11}$/.test(videoId))
            .map(({ v, videoId }: any, index: number) => {
              const durationSecs = v.duration || 0;
              return {
                id: `${playlistId}_${videoId}_${index}`,
                videoId,
                title: v.title || `Video ${index + 1}`,
                duration: durationSecs ? formatSeconds(durationSecs) : undefined,
                durationSeconds: durationSecs,
                thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                order: index + 1
              };
            });

          if (videos.length > 0) {
            return {
              title,
              channelTitle,
              description: data.description || '',
              thumbnailUrl: `https://i.ytimg.com/vi/${videos[0].videoId}/hqdefault.jpg`,
              videos
            };
          }
        }
      }
    } catch {
      // Continue to next instance
    }
  }

  // Fallback 2: No instance responded. Return empty videos so the caller can show an
  // actionable error instead of silently creating a broken 1-video course.
  return {
    title: `Curso de YouTube (${playlistId})`,
    channelTitle: 'YouTube',
    description: '',
    thumbnailUrl: `https://i.ytimg.com/vi/placeholder/hqdefault.jpg`,
    videos: []
  };
}

/**
 * Creates a complete Course object from user URL input
 */
export async function createCourseFromUrl(
  rawUrl: string,
  customTitle?: string,
  apiKey?: string
): Promise<Course> {
  const parsed = parseYouTubeUrl(rawUrl);
  if (!parsed.isValid) {
    throw new Error('La URL proporcionada no es un enlace válido de YouTube.');
  }

  const courseId = `course_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();

  // Case 1: Playlist
  if (parsed.playlistId) {
    const plData = await fetchPlaylistData(parsed.playlistId, apiKey);

    if (!plData.videos || plData.videos.length === 0) {
      throw new Error(
        'No se pudo cargar la lista de reproducción. El enlace puede ser privado, ' +
        'o los servidores públicos de YouTube están saturados. Inténtalo de nuevo.'
      );
    }

    // If a specific video ID was also in the URL (e.g. watch?v=XYZ&list=PL123), ensure it's first or set as lastPlayed
    let videos = plData.videos;
    if (parsed.videoId && (!videos || videos.length === 0 || !videos.some(v => v.videoId === parsed.videoId))) {
      const singleMeta = await fetchVideoOEmbed(parsed.videoId);
      const firstVideo: VideoItem = {
        id: `${courseId}_${parsed.videoId}_0`,
        videoId: parsed.videoId,
        title: singleMeta.title,
        thumbnailUrl: singleMeta.thumbnailUrl,
        order: 1
      };
      videos = [firstVideo, ...videos.filter(v => v.videoId !== parsed.videoId)];
    }

    return {
      id: courseId,
      youtubeUrl: parsed.normalizedUrl,
      type: 'playlist',
      playlistId: parsed.playlistId,
      title: customTitle?.trim() || plData.title,
      channelTitle: plData.channelTitle,
      description: plData.description,
      thumbnailUrl: plData.thumbnailUrl || (videos[0]?.thumbnailUrl) || 'https://i.ytimg.com/vi/placeholder/hqdefault.jpg',
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
      lastPlayedVideoId: parsed.videoId || videos[0]?.videoId,
      lastPlayedTimestamp: 0,
      videos
    };
  }

  // Case 2: Single Video Course
  if (parsed.videoId) {
    const meta = await fetchVideoOEmbed(parsed.videoId);
    const videoItem: VideoItem = {
      id: `${courseId}_${parsed.videoId}_1`,
      videoId: parsed.videoId,
      title: meta.title,
      thumbnailUrl: meta.thumbnailUrl,
      order: 1
    };

    return {
      id: courseId,
      youtubeUrl: parsed.normalizedUrl,
      type: 'single-video',
      title: customTitle?.trim() || meta.title,
      channelTitle: meta.authorName,
      description: `Curso individual de YouTube: ${meta.title}`,
      thumbnailUrl: meta.thumbnailUrl,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
      lastPlayedVideoId: parsed.videoId,
      lastPlayedTimestamp: 0,
      videos: [videoItem]
    };
  }

  throw new Error('No se pudo identificar el contenido del curso.');
}
