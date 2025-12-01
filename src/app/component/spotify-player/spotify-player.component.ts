import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { SpotifyAuthService } from '../../service/spotify-auth.service';
import { MusicPlayerService } from '../../service/music-player.service';
import { SpotifyApiService } from '../../service/spotify-api.service';
import { MatIconModule } from '@angular/material/icon';

declare var Spotify: any;

interface SpotifyPlayerState {
  device: {
    device_id: string;
    name: string;
    type: string;
    volume_percent: number;
  };
  track_window: {
    current_track: {
      id: string;
      name: string;
      artists: Array<{ name: string; uri: string }>;
      album: {
        name: string;
        images: Array<{ url: string; height: number; width: number }>;
      };
      duration_ms: number;
    };
    previous_tracks: any[];
    next_tracks: any[];
  };
  timestamp: number;
  position: number;
  duration: number;
  paused: boolean;
  shuffle: boolean;
  repeat_mode: number;
}

@Component({
  selector: 'spotify-player',
  templateUrl: './spotify-player.component.html',
  styleUrl: './spotify-player.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
})
export class SpotifyPlayerComponent implements OnInit, OnDestroy {
  auth = inject(SpotifyAuthService); // Make auth public for template access
  private musicPlayer = inject(MusicPlayerService);
  private api = inject(SpotifyApiService);

  // Signals for player state
  private playerState = signal<SpotifyPlayerState | null>(null);
  private deviceId = signal<string>('');
  isLoading = signal(true);
  isPlayerReady = signal(false);
  isLocalPlayerActive = signal(false);
  volume = signal(50);
  private previousVolume = 50;

  // Computed values
  currentTrack = computed(() => this.playerState()?.track_window?.current_track || null);
  isPaused = computed(() => this.playerState()?.paused ?? true);
  position = computed(() => this.playerState()?.position || 0);
  duration = computed(() => this.playerState()?.duration || 0);
  progressPercent = computed(() => {
    const pos = this.position();
    const dur = this.duration();
    return dur > 0 ? (pos / dur) * 100 : 0;
  });

  private player: any;
  private playerStateInterval: any;
  private authStateSubscription: any;

  ngOnInit(): void {
    this.initializePlayer();

    // Watch for authentication state changes
    this.watchAuthenticationState();
  }

  ngOnDestroy(): void {
    if (this.playerStateInterval) {
      clearInterval(this.playerStateInterval);
    }
    if (this.player) {
      this.player.disconnect();
    }
    if (this.authStateSubscription) {
      clearInterval(this.authStateSubscription);
    }
  }

  private watchAuthenticationState(): void {
    let wasAuthenticated = this.auth.isAuthenticated();

    // Check authentication state periodically
    this.authStateSubscription = setInterval(() => {
      const isCurrentlyAuthenticated = this.auth.isAuthenticated();

      // User just logged in
      if (
        isCurrentlyAuthenticated &&
        !wasAuthenticated &&
        !this.isPlayerReady() &&
        !this.isLoading()
      ) {
        this.initializePlayer();
      }

      // User just logged out
      if (!isCurrentlyAuthenticated && wasAuthenticated) {
        this.resetPlayer();
      }

      wasAuthenticated = isCurrentlyAuthenticated;
    }, 1000);
  }

  private resetPlayer(): void {
    if (this.player) {
      this.player.disconnect();
      this.player = null;
    }
    if (this.playerStateInterval) {
      clearInterval(this.playerStateInterval);
    }

    this.isPlayerReady.set(false);
    this.isLoading.set(false);
    this.playerState.set(null);
    this.deviceId.set('');
  }

  async initializePlayer(): Promise<void> {
    try {
      // Don't show loading if user is not authenticated
      if (!this.auth.isAuthenticated()) {
        this.isLoading.set(false);
        return;
      }

      this.isLoading.set(true);

      // Load Spotify Web Playback SDK
      await this.loadSpotifySDK();

      const token = await this.auth.getValidToken();

      // Set up SDK ready callback with timeout fallback
      (<any>window).onSpotifyWebPlaybackSDKReady = () => {
        this.connectPlayer(token);
      };

      // Wait for SDK to be ready with timeout
      let attempts = 0;
      const maxAttempts = 20; // 10 seconds maximum

      const checkSDKReady = () => {
        attempts++;

        if ((<any>window).Spotify) {
          this.connectPlayer(token);
        } else if (attempts < maxAttempts) {
          setTimeout(checkSDKReady, 500);
        } else {
          this.isLoading.set(false);
        }
      };

      // Start checking
      setTimeout(checkSDKReady, 100);
    } catch (error) {
      this.isLoading.set(false);
    }
  }

  private loadSpotifySDK(): Promise<void> {
    return new Promise((resolve) => {
      // Check if SDK is already loaded
      if ((<any>window).Spotify) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;

      script.onload = () => {
        // Wait a bit for the SDK to initialize
        setTimeout(() => resolve(), 500);
      };

      // Ignore toutes les erreurs - le SDK fonctionne malgré les erreurs rapportées
      script.onerror = () => {
        // On ignore l'erreur et on continue quand même
        setTimeout(() => resolve(), 500);
      };

      document.head.appendChild(script);
    });
  }

  private connectPlayer(token: string): void {
    try {
      // Check if Spotify SDK is available
      if (!(<any>window).Spotify) {
        this.isLoading.set(false);
        return;
      }

      this.player = new (<any>window).Spotify.Player({
        name: 'Grosse Toune Web Player',
        getOAuthToken: (cb: any) => {
          cb(token);
        },
        volume: this.volume() / 100,
      });
    } catch (error) {
      this.isLoading.set(false);
      return;
    }

    // Event listeners
    this.player.addListener('ready', ({ device_id }: { device_id: string }) => {
      this.deviceId.set(device_id);
      this.musicPlayer.deviceId.set(device_id);
      this.isPlayerReady.set(true);
      this.isLoading.set(false);
      this.startPlayerStateUpdates();
    });

    this.player.addListener('not_ready', ({ device_id }: { device_id: string }) => {
      this.isPlayerReady.set(false);
      this.musicPlayer.deviceId.set(null);
    });

    this.player.addListener('player_state_changed', (state: SpotifyPlayerState | null) => {
      if (state) {
        this.playerState.set(state);
      }
    });

    // Error listeners - Silent mode
    this.player.addListener('initialization_error', () => {
      this.isLoading.set(false);
    });

    this.player.addListener('authentication_error', () => {
      this.isLoading.set(false);
    });

    this.player.addListener('account_error', () => {
      this.isLoading.set(false);
    });

    this.player.addListener('playback_error', () => {
      // Ignore playback errors silently
    });

    // Connect player - Silent mode
    this.player.connect().then((success: boolean) => {
      if (!success) {
        this.isLoading.set(false);
      }
    });
  }

  private startPlayerStateUpdates(): void {
    if (this.playerStateInterval) {
      clearInterval(this.playerStateInterval);
    }

    this.playerStateInterval = setInterval(async () => {
      let state = null;
      let isLocal = false;

      if (this.player) {
        state = await this.player.getCurrentState();
        if (state) {
          isLocal = true;
        }
      }

      if (!state) {
        // Fallback to API if player state is not available (e.g. playing on another device)
        try {
          const apiState = await this.api.getPlaybackState();
          if (apiState && apiState.item) {
            state = {
              device: apiState.device,
              track_window: {
                current_track: apiState.item,
                previous_tracks: [],
                next_tracks: [],
              },
              timestamp: apiState.timestamp,
              position: apiState.progress_ms,
              duration: apiState.item.duration_ms,
              paused: !apiState.is_playing,
              shuffle: apiState.shuffle_state,
              repeat_mode: apiState.repeat_state === 'off' ? 0 : 1,
            };
          }
        } catch (e) {
          // Ignore API errors
        }
      }

      this.isLocalPlayerActive.set(isLocal);

      if (state) {
        this.playerState.set(state);

        // Synchroniser avec le service partagé
        const currentTrack = state.track_window.current_track;
        if (currentTrack && currentTrack.id) {
          // Créer un objet SpotifyTrack compatible
          const trackForService = {
            id: currentTrack.id,
            name: currentTrack.name,
            artists: currentTrack.artists,
            album: currentTrack.album,
            duration_ms: currentTrack.duration_ms,
            explicit: false, // Cette info n'est pas disponible dans le state du player
            external_urls: { spotify: '' },
            popularity: 0,
            preview_url: null,
            track_number: 1,
            uri: currentTrack.uri || `spotify:track:${currentTrack.id}`,
          };

          this.musicPlayer.setCurrentTrack(trackForService);
          this.musicPlayer.setPlayingState(!state.paused);
        }
      }
    }, 1000);
  }

  // Public methods for player controls
  async togglePlay(): Promise<void> {
    if (this.isLocalPlayerActive() && this.player) {
      await this.player.togglePlay();
    } else {
      if (this.isPaused()) {
        // Si on veut jouer et qu'on a un device local prêt, on l'utilise
        if (this.isPlayerReady() && this.deviceId()) {
          await this.api.transferPlayback(this.deviceId());
        } else {
          await this.api.play();
        }
      } else {
        await this.api.pause();
      }
    }
  }

  async playNextTrack(): Promise<void> {
    if (this.isLocalPlayerActive() && this.player) {
      await this.player.nextTrack();
    } else {
      await this.api.next();
    }
  }

  async playPreviousTrack(): Promise<void> {
    if (this.isLocalPlayerActive() && this.player) {
      await this.player.previousTrack();
    } else {
      await this.api.previous();
    }
  }

  async incrementVolume(): Promise<void> {
    const newVolume = Math.min(100, this.volume() + 10);
    await this.setVolume(newVolume);
  }

  async decrementVolume(): Promise<void> {
    const newVolume = Math.max(0, this.volume() - 10);
    await this.setVolume(newVolume);
  }

  async toggleMute(): Promise<void> {
    if (this.volume() > 0) {
      this.previousVolume = this.volume();
      await this.setVolume(0);
    } else {
      await this.setVolume(this.previousVolume || 50);
    }
  }

  setVolumeFromClick(event: MouseEvent): void {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    this.setVolume(Math.round(percentage));
  }

  private async setVolume(volume: number): Promise<void> {
    if (this.isLocalPlayerActive() && this.player) {
      await this.player.setVolume(volume / 100);
    } else {
      await this.api.setVolume(volume);
    }
    this.volume.set(volume);
  }

  async seekToPosition(event: MouseEvent): Promise<void> {
    const progressBar = event.currentTarget as HTMLElement;
    const rect = progressBar.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const positionMs = Math.round(percentage * this.duration());

    if (this.isLocalPlayerActive() && this.player) {
      await this.player.seek(positionMs);
    } else {
      await this.api.seek(positionMs);
    }
  }

  // Utility methods
  canSkipToNext(): boolean {
    if (this.isLocalPlayerActive()) {
      return (this.playerState()?.track_window?.next_tracks?.length ?? 0) > 0;
    }
    return true; // API fallback assumes we can skip
  }

  canSkipToPrevious(): boolean {
    if (this.isLocalPlayerActive()) {
      return (this.playerState()?.track_window?.previous_tracks?.length ?? 0) > 0;
    }
    return true; // API fallback assumes we can skip
  }

  formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  getArtistsString(artists: Array<{ name: string }>): string {
    return artists.map((artist) => artist.name).join(', ');
  }
}
