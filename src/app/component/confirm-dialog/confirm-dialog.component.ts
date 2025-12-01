import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { SpotifyTrack } from '../../service/spotify-api.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, CommonModule],
  template: `
    <h2 mat-dialog-title>Confirmer la demande</h2>
    <mat-dialog-content>
      <p>Voulez-vous faire une demande pour faire jouer cette chanson ?</p>
      <div class="track-preview">
        @if (data.album.images[0]?.url) {
        <img [src]="data.album.images[0].url" [alt]="data.album.name" class="album-cover" />
        }
        <div class="track-info">
          <div class="track-name">{{ data.name }}</div>
          <div class="track-artist">{{ data.artists[0].name }}</div>
          <div class="track-album">{{ data.album.name }}</div>
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Annuler</button>
      <button mat-raised-button color="primary" [mat-dialog-close]="true">Confirmer</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .track-preview {
        display: flex;
        gap: 16px;
        margin-top: 16px;
        align-items: center;
      }
      .album-cover {
        width: 64px;
        height: 64px;
        border-radius: 4px;
        object-fit: cover;
      }
      .track-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .track-name {
        font-weight: 500;
        font-size: 16px;
      }
      .track-artist,
      .track-album {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.7);
      }
    `,
  ],
})
export class ConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SpotifyTrack
  ) {}
}
