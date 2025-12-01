import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnDestroy,
  ElementRef,
  ViewChild,
  OnInit,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { SpotifyApiService, SpotifyTrack } from '../../service/spotify-api.service';
import { SpotifyAuthService } from '../../service/spotify-auth.service';
import { MusicPlayerService } from '../../service/music-player.service';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { firstValueFrom } from 'rxjs';
import { SignalRService } from '../../service/signalr.service';
import { UserProfileComponent } from '../user-profile/user-profile.component';

@Component({
  selector: 'spotify-search',
  templateUrl: './spotify-search.component.html',
  styleUrl: './spotify-search.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatProgressSpinnerModule, FormsModule, UserProfileComponent],
})
export class SpotifySearchComponent implements OnInit, OnDestroy {
  @ViewChild('resultsContainer') resultsContainer!: ElementRef<HTMLDivElement>;

  private api = inject(SpotifyApiService);
  public auth = inject(SpotifyAuthService);
  private musicPlayer = inject(MusicPlayerService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);
  private signalR = inject(SignalRService);

  searchQuery = signal('');
  private searchTimeout: any;
  private scrollListener?: () => void;
  private isUpdatingFromUrl = false;
  playingTrack = signal<string | null>(null);

  ngOnInit(): void {
    // Écouter les changements de query parameters
    this.route.queryParamMap.subscribe((params) => {
      const queryParam = params.get('q') || '';
      const currentQuery = this.searchQuery();

      // Mettre à jour la recherche seulement si le query param a changé et qu'on n'est pas en train de mettre à jour depuis l'input
      if (queryParam !== currentQuery && !this.isUpdatingFromUrl) {
        this.isUpdatingFromUrl = true;
        this.searchQuery.set(queryParam);

        if (queryParam && this.auth.isAuthenticated()) {
          this.performSearch(queryParam);
        } else if (!queryParam) {
          this.api.clearResults();
        }

        this.isUpdatingFromUrl = false;
      }
    });
  }

  ngAfterViewInit(): void {
    // Ajouter l'écouteur de scroll pour le chargement infini
    if (this.resultsContainer) {
      this.scrollListener = () => this.onScroll();
      this.resultsContainer.nativeElement.addEventListener('scroll', this.scrollListener);
    }
  }

  ngOnDestroy(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    if (this.scrollListener && this.resultsContainer) {
      this.resultsContainer.nativeElement.removeEventListener('scroll', this.scrollListener);
    }
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const query = target.value.trim();
    this.searchQuery.set(query);

    // Mettre à jour l'URL avec le query parameter seulement si on n'est pas en train de mettre à jour depuis l'URL
    if (!this.isUpdatingFromUrl) {
      this.updateUrlQueryParam(query);
    }

    // Effacer le timeout précédent
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    if (query.length === 0) {
      this.api.clearResults();
      return;
    }

    // Débounce la recherche (attendre 300ms après la dernière frappe)
    this.searchTimeout = setTimeout(() => {
      this.performSearch(query);
    }, 300);
  }

  private async performSearch(query: string): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      return;
    }

    try {
      await this.api.searchTracks(query, 20, 0);
    } catch (error) {
      console.error('Search failed:', error);
      // Vous pourriez vouloir afficher un message d'erreur à l'utilisateur ici
    }
  }

  private onScroll(): void {
    if (!this.resultsContainer) return;

    const element = this.resultsContainer.nativeElement;
    const { scrollTop, scrollHeight, clientHeight } = element;

    // Si on est proche du bas (100px avant la fin)
    if (scrollHeight - scrollTop - clientHeight < 100) {
      const query = this.searchQuery();
      if (query && this.api.hasMoreResults() && !this.api.isSearching()) {
        this.api.loadMoreResults(query);
      }
    }
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.api.clearResults();
    // Supprimer le query parameter de l'URL
    this.updateUrlQueryParam('');
  }

  private updateUrlQueryParam(query: string): void {
    const queryParams = query ? { q: query } : {};
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge', // Conserver les autres query params s'il y en a
      replaceUrl: true, // Remplacer l'entrée d'historique actuelle
    });
  }

  // Getters pour les signals de l'API
  get isSearching() {
    return this.api.isSearching;
  }
  get searchResults() {
    return this.api.searchResults;
  }
  get totalResults() {
    return this.api.totalResults;
  }
  get hasMoreResults() {
    return this.api.hasMoreResults;
  }

  // Méthodes utilitaires de l'API
  formatDuration = this.api.formatDuration;
  getArtistsString = this.api.getArtistsString;
  getAlbumImage = this.api.getAlbumImage;

  async playTrack(track: SpotifyTrack): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      this.snackBar.open('Vous devez être connecté à Spotify', 'OK', {
        duration: 3000,
        panelClass: ['error-snackbar'],
      });
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: track,
      width: '400px',
      panelClass: 'confirm-dialog-container',
    });

    const result = await firstValueFrom(dialogRef.afterClosed());

    if (!result) {
      return;
    }

    // Broadcast submission to SignalR hub
    const userProfile = this.auth.userProfile();
    const userName = userProfile?.display_name || 'Utilisateur inconnu';

    try {
      await this.signalR.broadcastSpotifySubmission(track.id, userName);
      this.snackBar.open(`Demande envoyée pour "${track.name}"`, 'OK', {
        duration: 3000,
        panelClass: ['success-snackbar'],
      });
    } catch (error) {
      console.error('Error broadcasting submission:', error);
      this.snackBar.open("Erreur lors de l'envoi de la demande", 'OK', {
        duration: 3000,
        panelClass: ['error-snackbar'],
      });
    }
  }

  isTrackPlaying(trackId: string): boolean {
    const currentTrack = this.musicPlayer.currentTrack();
    return currentTrack?.id === trackId && this.musicPlayer.isPlaying();
  }
}
