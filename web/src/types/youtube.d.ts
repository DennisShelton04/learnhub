// Minimal typings for the YouTube IFrame Player API used by study rooms.
declare namespace YT {
  enum PlayerState {
    UNSTARTED = -1,
    ENDED = 0,
    PLAYING = 1,
    PAUSED = 2,
    BUFFERING = 3,
    CUED = 5,
  }
  interface PlayerEvent {
    target: Player;
    data: number;
  }
  interface PlayerOptions {
    videoId?: string;
    host?: string;
    playerVars?: Record<string, string | number>;
    events?: { onReady?: (e: PlayerEvent) => void; onStateChange?: (e: PlayerEvent) => void };
  }
  class Player {
    constructor(element: HTMLElement | string, options: PlayerOptions);
    playVideo(): void;
    pauseVideo(): void;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    getCurrentTime(): number;
    getPlayerState(): number;
    destroy(): void;
  }
}

interface Window {
  YT?: typeof YT;
  onYouTubeIframeAPIReady?: () => void;
}
