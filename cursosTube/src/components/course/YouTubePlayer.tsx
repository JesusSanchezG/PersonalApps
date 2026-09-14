import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YouTubePlayerProps {
  videoId: string;
  initialTimeSeconds?: number;
  onVideoEnded: () => void;
  onTimeUpdate?: (seconds: number) => void;
  onPlayerReady?: (player: any) => void;
  autoPlay?: boolean;
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  initialTimeSeconds = 0,
  onVideoEnded,
  onTimeUpdate,
  onPlayerReady,
  autoPlay = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [isApiReady, setIsApiReady] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const timeIntervalRef = useRef<any>(null);

  // Load YouTube IFrame API script if not already loaded
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setIsApiReady(true);
      return;
    }

    const existingScript = document.getElementById('youtube-iframe-api');
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (previousCallback) previousCallback();
      setIsApiReady(true);
    };
  }, []);

  // Initialize or update player
  useEffect(() => {
    if (!isApiReady || !containerRef.current || !videoId) return;

    setIsLoading(true);

    const onStateChange = (event: any) => {
      // event.data === 0 (YT.PlayerState.ENDED)
      if (event.data === 0) {
        onVideoEnded();
      }
    };

    // Antes de reproducir, asegura que la posición de reanudación no quede
    // a menos de 3s del final: una lección ya completada reaparece en 0 para
    // que no termine al instante y salte sola a la siguiente clase.
    const clampStartToSafe = (player: any, initial: number) => {
      if (!initial || typeof player.getDuration !== 'function') return;
      let tries = 0;
      const id = window.setInterval(() => {
        tries += 1;
        try {
          const duration = player.getDuration();
          if (duration > 0) {
            window.clearInterval(id);
            if (initial >= duration - 3) {
              try {
                player.seekTo(0, true);
              } catch {
                // ignore seek errors
              }
            }
            return;
          }
        } catch {
          // player not ready yet
        }
        if (tries > 8) window.clearInterval(id);
      }, 300);
    };

    const onReady = (event: any) => {
      setIsLoading(false);
      clampStartToSafe(event.target, initialTimeSeconds);
      if (autoPlay) {
        try {
          event.target.playVideo();
        } catch {
          // Autoplay blocked by browser policy until interaction
        }
      }
      if (onPlayerReady) {
        onPlayerReady(event.target);
      }
    };

    // If player already exists, load new video
    if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
      try {
        playerRef.current.loadVideoById({
          videoId,
          startSeconds: initialTimeSeconds || 0,
        });
        clampStartToSafe(playerRef.current, initialTimeSeconds);
        setIsLoading(false);
        return;
      } catch (e) {
        console.warn('Reloading player instance:', e);
      }
    }

    // Create player element inside container
    const playerId = `yt-player-${Math.random().toString(36).substring(2, 9)}`;
    const playerElement = document.createElement('div');
    playerElement.id = playerId;
    playerElement.style.width = '100%';
    playerElement.style.height = '100%';

    // Clear previous
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(playerElement);
    }

    try {
      playerRef.current = new window.YT.Player(playerId, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: autoPlay ? 1 : 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          enablejsapi: 1,
          start: Math.floor(initialTimeSeconds) || 0,
          origin: window.location.origin,
        },
        events: {
          onReady,
          onStateChange,
        },
      });

      // Force fullscreen attributes on the generated iframe (some mobile
      // browsers ignore the ones injected by the IFrame API).
      const ensureIframeFullscreen = () => {
        const iframe = playerRef.current?.getIframe?.();
        if (iframe) {
          iframe.setAttribute('allowfullscreen', '');
          iframe.setAttribute('webkitallowfullscreen', 'true');
          iframe.setAttribute('mozallowfullscreen', 'true');
        }
      };
      ensureIframeFullscreen();
      window.setTimeout(ensureIframeFullscreen, 300);
    } catch (err) {
      console.error('Failed to initialize YouTube player:', err);
      setIsLoading(false);
    }

    return () => {
      if (timeIntervalRef.current) {
        clearInterval(timeIntervalRef.current);
      }
    };
  }, [isApiReady, videoId]);

  // Mobile fullscreen handling:
  // - Keep the video contained inside the viewport (no overflow beyond screen).
  // - Force landscape orientation while fullscreen (so the phone rotates).
  // - Re-apply constraints after rotation/resize and when exiting fullscreen.
  useEffect(() => {
    const isMobile = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent);

    const isInFullscreen = () =>
      !!(document.fullscreenElement || (document as any).webkitFullscreenElement);

    const applyConstraints = () => {
      const iframe = playerRef.current?.getIframe?.();

      if (isInFullscreen()) {
        // Lock page scroll while fullscreen
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';

        if (iframe) {
          iframe.style.width = '100vw';
          iframe.style.height = '100vh';
          iframe.style.maxWidth = '100vw';
          iframe.style.maxHeight = '100vh';
          iframe.style.objectFit = 'contain';
          iframe.style.borderRadius = '0';
        }

        // Force landscape orientation on mobile (only allowed in fullscreen)
        if (isMobile) {
          try {
            const ori = (screen as any).orientation;
            if (ori && typeof ori.lock === 'function') {
              ori.lock('landscape').catch(() => {});
            }
          } catch {
            // Orientation lock not supported (e.g. iOS) — YouTube handles it natively
          }
        }
      } else {
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';

        if (iframe) {
          iframe.style.width = '100%';
          iframe.style.height = '100%';
          iframe.style.maxWidth = '';
          iframe.style.maxHeight = '';
          iframe.style.objectFit = '';
          iframe.style.borderRadius = '';
        }
      }
    };

    const onFullscreenChange = () => requestAnimationFrame(applyConstraints);

    const onResize = () => {
      // While fullscreen (e.g. after orientation rotation), re-clamp sizes
      if (isInFullscreen()) applyConstraints();
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // Periodic time updates for checkpoint saving
  useEffect(() => {
    if (timeIntervalRef.current) {
      clearInterval(timeIntervalRef.current);
    }

    timeIntervalRef.current = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        try {
          const state = playerRef.current.getPlayerState();
          // State 1 is playing
          if (state === 1) {
            const currentTime = playerRef.current.getCurrentTime();
            if (onTimeUpdate && typeof currentTime === 'number') {
              onTimeUpdate(currentTime);
            }
          }
        } catch {
          // Ignore polling errors
        }
      }
    }, 3000); // Save position every 3 seconds

    return () => {
      if (timeIntervalRef.current) {
        clearInterval(timeIntervalRef.current);
      }
    };
  }, [onTimeUpdate]);

  return (
    <div className="relative w-full rounded-2xl bg-navy-950 shadow-2xl border border-navy-800">
      {/* Aspect ratio via padding-top hack (16:9). Avoids CSS aspect-ratio +
          overflow:hidden which breaks fullscreen on iOS Safari / Android Chrome.
          The iframe (fullscreen element) lives inside this non-clipped box. */}
      <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
        {/* Player container */}
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-btn flex flex-col items-center justify-center text-white pointer-events-none transition-opacity rounded-2xl">
            <Loader2 className="w-8 h-8 animate-spin text-sky-400 mb-2" />
            <span className="text-xs text-slate-300 font-medium">Cargando reproductor de YouTube...</span>
          </div>
        )}
      </div>
    </div>
  );
};
