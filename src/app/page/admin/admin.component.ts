import { Component, OnInit, OnDestroy, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SpotifyApiService, SpotifyTrack } from '../../service/spotify-api.service';
import { SignalRService } from '../../service/signalr.service';
import { SpotifyPlayerComponent } from '../../component/spotify-player/spotify-player.component';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { SubmissionsDialogComponent } from '../../component/submissions-dialog/submissions-dialog.component';
import { MatBadgeModule } from '@angular/material/badge';
import { MusicPlayerService } from '../../service/music-player.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    SpotifyPlayerComponent,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatBadgeModule,
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent implements OnInit, OnDestroy {
  private spotifyApi = inject(SpotifyApiService);
  public signalR = inject(SignalRService);
  private dialog = inject(MatDialog);
  private musicPlayer = inject(MusicPlayerService);

  queue = signal<SpotifyTrack[]>([]);
  isLoading = signal(false);
  private refreshInterval: any;

  constructor() {
    effect(() => {
      this.musicPlayer.queueUpdated();
      this.loadQueue(true);
    });
  }

  ngOnInit() {
    this.signalR.joinAdminGroup();
    this.loadQueue();

    // Rafraîchir la file d'attente toutes les 10 secondes
    this.refreshInterval = setInterval(() => {
      this.loadQueue(true);
    }, 10000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  async loadQueue(isBackground = false) {
    if (!isBackground) {
      this.isLoading.set(true);
    }
    try {
      const queue = await this.spotifyApi.getUserQueue();
      this.queue.set(queue);
    } catch (error) {
      console.error('Error loading queue:', error);
    } finally {
      if (!isBackground) {
        this.isLoading.set(false);
      }
    }
  }

  openSubmissions() {
    this.dialog.open(SubmissionsDialogComponent, {
      width: '500px',
      panelClass: 'submissions-dialog-container',
    });
  }

  formatDuration(ms: number): string {
    return this.spotifyApi.formatDuration(ms);
  }

  getArtistsString(artists: any[]): string {
    return this.spotifyApi.getArtistsString(artists);
  }
}
