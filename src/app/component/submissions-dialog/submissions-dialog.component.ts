import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SignalRService, SpotifySubmission } from '../../service/signalr.service';
import { SpotifyApiService, SpotifyTrack } from '../../service/spotify-api.service';

interface SubmissionWithTrack extends SpotifySubmission {
  track?: SpotifyTrack;
}

import { MusicPlayerService } from '../../service/music-player.service';

@Component({
  selector: 'app-submissions-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="dialog-header">
      <h2 mat-dialog-title>Demandes reçues</h2>
      <button
        mat-icon-button
        (click)="clearAll()"
        title="Tout supprimer"
        [disabled]="sortedSubmissions().length === 0"
      >
        <mat-icon>delete_sweep</mat-icon>
      </button>
    </div>
    <mat-dialog-content>
      @if (isLoading()) {
      <div class="loading-container">
        <mat-spinner diameter="40"></mat-spinner>
      </div>
      } @else {
      <div class="submissions-list">
        @for (item of sortedSubmissions(); track item.receivedAtUtc) {
        <div class="submission-item">
          <div class="track-image">
            @if (item.track?.album?.images?.[0]?.url) {
            <img [src]="item.track!.album.images[0].url" [alt]="item.track!.name" />
            } @else {
            <div class="placeholder-image">
              <mat-icon>music_note</mat-icon>
            </div>
            }
          </div>
          <div class="submission-info">
            <div class="track-name">{{ item.track?.name || 'Chargement...' }}</div>
            <div class="track-artist">
              @if (item.track) {
              {{ getArtistsString(item.track.artists) }}
              }
            </div>
            <div class="requester-info">
              Demandé par <strong>{{ item.fullName }}</strong>
            </div>
          </div>
          <div class="actions">
            <button
              mat-icon-button
              color="primary"
              (click)="approveSubmission(item)"
              title="Ajouter à la file d'attente"
            >
              <mat-icon>check</mat-icon>
            </button>
            <button
              mat-icon-button
              color="warn"
              (click)="removeSubmission(item)"
              title="Supprimer la demande"
            >
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        </div>
        } @empty {
        <div class="empty-state">
          <p>Aucune demande reçue pour le moment.</p>
        </div>
        }
      </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Fermer</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-right: 16px;
        h2 {
          margin: 0;
        }
      }
      .loading-container {
        display: flex;
        justify-content: center;
        padding: 20px;
      }
      .submissions-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-width: 400px;
        max-height: 60vh;
      }
      .submission-item {
        display: flex;
        gap: 12px;
        padding: 8px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.05);
        align-items: center;
      }
      .track-image {
        width: 48px;
        height: 48px;
        flex-shrink: 0;
        img {
          width: 100%;
          height: 100%;
          border-radius: 4px;
          object-fit: cover;
        }
        .placeholder-image {
          width: 100%;
          height: 100%;
          background: #333;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
        }
      }
      .submission-info {
        flex: 1;
        min-width: 0;
      }
      .track-name {
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .track-artist {
        font-size: 12px;
        color: #b3b3b3;
        margin-bottom: 4px;
      }
      .requester-info {
        font-size: 12px;
        color: #1db954;
      }
      .actions {
        display: flex;
        gap: 4px;
      }
      .empty-state {
        text-align: center;
        padding: 20px;
        color: #888;
      }
    `,
  ],
})
export class SubmissionsDialogComponent implements OnInit {
  private signalR = inject(SignalRService);
  private spotifyApi = inject(SpotifyApiService);
  private snackBar = inject(MatSnackBar);
  private musicPlayer = inject(MusicPlayerService);

  submissions = signal<SubmissionWithTrack[]>([]);
  isLoading = signal(false);

  sortedSubmissions = signal<SubmissionWithTrack[]>([]);

  ngOnInit() {
    this.loadSubmissions();
  }

  async loadSubmissions() {
    this.isLoading.set(true);
    const rawSubmissions = this.signalR.submissions();

    const submissionsWithTracks: SubmissionWithTrack[] = [];

    for (const sub of rawSubmissions) {
      try {
        const track = await this.spotifyApi.getTrack(sub.spotifySongId);
        submissionsWithTracks.push({ ...sub, track });
      } catch (e) {
        console.error(`Failed to load track ${sub.spotifySongId}`, e);
        submissionsWithTracks.push({ ...sub });
      }
    }

    // Sort by ReceivedAtUtc
    submissionsWithTracks.sort(
      (a, b) => new Date(b.receivedAtUtc).getTime() - new Date(a.receivedAtUtc).getTime()
    );

    this.submissions.set(submissionsWithTracks);
    this.sortedSubmissions.set(submissionsWithTracks);
    this.isLoading.set(false);
  }

  getArtistsString(artists: any[]): string {
    return this.spotifyApi.getArtistsString(artists);
  }

  removeSubmission(submission: SpotifySubmission) {
    this.signalR.removeSubmission(submission);
    this.loadSubmissions();
  }

  clearAll() {
    this.signalR.clearSubmissions();
    this.loadSubmissions();
  }

  async approveSubmission(submission: SubmissionWithTrack) {
    if (!submission.track) return;

    try {
      const deviceId = this.musicPlayer.deviceId();
      await this.spotifyApi.addToQueue(submission.track.uri, deviceId);
      this.musicPlayer.notifyQueueUpdated();
      this.snackBar.open(`"${submission.track.name}" ajouté à la file d'attente`, 'OK', {
        duration: 3000,
      });
      this.removeSubmission(submission);
    } catch (error: any) {
      console.error('Error adding to queue:', error);
      this.snackBar.open(error.message || "Erreur lors de l'ajout à la file d'attente", 'OK', {
        duration: 3000,
        panelClass: ['error-snackbar'],
      });
    }
  }
}
