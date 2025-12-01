import { Injectable, inject, signal } from '@angular/core';
import { SpotifyAuthService } from './spotify-auth.service';

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string; id: string }>;
  album: {
    name: string;
    id: string;
    images: Array<{ url: string; height: number; width: number }>;
  };
  duration_ms: number;
  explicit: boolean;
  external_urls: {
    spotify: string;
  };
  popularity: number;
  preview_url: string | null;
  track_number: number;
  uri: string;
}

export interface SpotifySearchResponse {
  tracks: {
    href: string;
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
    items: SpotifyTrack[];
  };
}

@Injectable({ providedIn: 'root' })
export class SpotifyApiService {
  private auth = inject(SpotifyAuthService);

  // Signals pour l'état de recherche
  isSearching = signal(false);
  searchResults = signal<SpotifyTrack[]>([]);
  totalResults = signal(0);
  currentOffset = signal(0);
  hasMoreResults = signal(false);

  async getUserQueue(): Promise<SpotifyTrack[]> {
    if (!this.auth.token()) {
      throw new Error('No access token available');
    }

    const response = await fetch('https://api.spotify.com/v1/me/player/queue', {
      headers: {
        Authorization: `Bearer ${this.auth.token()}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        await this.auth.getValidToken();
        return this.getUserQueue();
      }
      throw new Error(`Failed to fetch queue: ${response.status}`);
    }

    const data = await response.json();
    return data.queue || [];
  }

  async searchTracks(
    query: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<SpotifySearchResponse> {
    if (!this.auth.token()) {
      throw new Error('No access token available');
    }

    this.isSearching.set(true);

    try {
      const params = new URLSearchParams({
        q: query,
        type: 'track',
        limit: limit.toString(),
        offset: offset.toString(),
        market: 'from_token', // Utiliser le pays du compte utilisateur
      });

      const response = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${this.auth.token()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expiré, essayer de le rafraîchir
          await this.auth.getValidToken();
          // Retry avec le nouveau token
          return this.searchTracks(query, limit, offset);
        }
        throw new Error(`Search failed: ${response.status} ${response.statusText}`);
      }

      const data: SpotifySearchResponse = await response.json();

      // Mettre à jour les signals
      if (offset === 0) {
        // Nouvelle recherche
        this.searchResults.set(data.tracks.items);
      } else {
        // Ajouter à la liste existante (pagination) en évitant les doublons
        this.searchResults.update((current) => {
          const currentIds = new Set(current.map((t) => t.id));
          const newItems = data.tracks.items.filter((item) => !currentIds.has(item.id));
          return [...current, ...newItems];
        });
      }

      this.totalResults.set(data.tracks.total);
      this.currentOffset.set(offset + data.tracks.items.length);
      this.hasMoreResults.set(data.tracks.next !== null);

      return data;
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    } finally {
      this.isSearching.set(false);
    }
  }

  async loadMoreResults(query: string): Promise<void> {
    if (this.hasMoreResults() && !this.isSearching()) {
      await this.searchTracks(query, 20, this.currentOffset());
    }
  }

  clearResults(): void {
    this.searchResults.set([]);
    this.totalResults.set(0);
    this.currentOffset.set(0);
    this.hasMoreResults.set(false);
  }

  async playTrack(trackUri: string, deviceId?: string): Promise<void> {
    const token = this.auth.token();
    if (!token) {
      throw new Error('No access token available');
    }

    const body: any = {
      uris: [trackUri],
    };

    if (deviceId) {
      body.device_id = deviceId;
    }

    const response = await fetch('https://api.spotify.com/v1/me/player/play', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          'Aucun appareil Spotify actif trouvé. Veuillez ouvrir Spotify sur un appareil.'
        );
      }
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Erreur lors de la lecture');
    }
  }

  async getTrack(id: string): Promise<SpotifyTrack> {
    if (!this.auth.token()) {
      throw new Error('No access token available');
    }

    const response = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
      headers: {
        Authorization: `Bearer ${this.auth.token()}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        await this.auth.getValidToken();
        return this.getTrack(id);
      }
      throw new Error(`Failed to fetch track: ${response.status}`);
    }

    return await response.json();
  }

  async addToQueue(uri: string, deviceId?: string | null): Promise<void> {
    const token = await this.auth.getValidToken();
    let url = `https://api.spotify.com/v1/me/player/queue?uri=${uri}`;
    if (deviceId) {
      url += `&device_id=${deviceId}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          'Aucun appareil Spotify actif trouvé. Veuillez ouvrir Spotify sur un appareil.'
        );
      }
      throw new Error(`Failed to add to queue: ${response.status}`);
    }
  }

  async getPlaybackState(): Promise<any> {
    const token = await this.auth.getValidToken();
    const response = await fetch('https://api.spotify.com/v1/me/player', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 204) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch playback state: ${response.status}`);
    }

    return await response.json();
  }

  async play(deviceId?: string): Promise<void> {
    const token = await this.auth.getValidToken();
    let url = 'https://api.spotify.com/v1/me/player/play';
    if (deviceId) {
      url += `?device_id=${deviceId}`;
    }
    await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async transferPlayback(deviceId: string): Promise<void> {
    const token = await this.auth.getValidToken();
    await fetch('https://api.spotify.com/v1/me/player', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        device_ids: [deviceId],
        play: true,
      }),
    });
  }

  async pause(deviceId?: string): Promise<void> {
    const token = await this.auth.getValidToken();
    let url = 'https://api.spotify.com/v1/me/player/pause';
    if (deviceId) {
      url += `?device_id=${deviceId}`;
    }
    await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async next(): Promise<void> {
    const token = await this.auth.getValidToken();
    await fetch('https://api.spotify.com/v1/me/player/next', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async previous(): Promise<void> {
    const token = await this.auth.getValidToken();
    await fetch('https://api.spotify.com/v1/me/player/previous', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async setVolume(volumePercent: number): Promise<void> {
    const token = await this.auth.getValidToken();
    await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${volumePercent}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async seek(positionMs: number, deviceId?: string): Promise<void> {
    const token = await this.auth.getValidToken();
    let url = `https://api.spotify.com/v1/me/player/seek?position_ms=${positionMs}`;
    if (deviceId) {
      url += `&device_id=${deviceId}`;
    }
    await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  formatDuration(durationMs: number): string {
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  getArtistsString(artists: Array<{ name: string }>): string {
    return artists.map((artist) => artist.name).join(', ');
  }

  getAlbumImage(track: SpotifyTrack): string | null {
    return track.album.images[0]?.url || null;
  }
}
