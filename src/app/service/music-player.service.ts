import { Injectable, signal } from '@angular/core';
import { SpotifyTrack } from './spotify-api.service';

@Injectable({ providedIn: 'root' })
export class MusicPlayerService {
  // Signal pour la chanson actuellement sélectionnée
  currentTrack = signal<SpotifyTrack | null>(null);
  isPlaying = signal(false);
  deviceId = signal<string | null>(null);
  queueUpdated = signal<number>(0);

  // Méthode pour définir la chanson actuelle
  setCurrentTrack(track: SpotifyTrack): void {
    this.currentTrack.set(track);
  }

  // Méthode pour changer l'état de lecture
  setPlayingState(playing: boolean): void {
    this.isPlaying.set(playing);
  }

  // Méthode pour clear la chanson actuelle
  clearCurrentTrack(): void {
    this.currentTrack.set(null);
    this.isPlaying.set(false);
  }

  // Méthode pour notifier que la file d'attente a changé
  notifyQueueUpdated(): void {
    this.queueUpdated.update((v) => v + 1);
  }
}
