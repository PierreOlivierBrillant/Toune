import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SpotifyAuthService } from '../../service/spotify-auth.service';

@Component({
  selector: 'spotify-callback',
  templateUrl: './spotify-callback.component.html',
  styleUrl: './spotify-callback.component.scss'
})
export class SpotifyCallbackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(SpotifyAuthService);

  isLoading = true;
  error: string | null = null;

  async ngOnInit(): Promise<void> {
    try {
      const params = this.route.snapshot.queryParams;
      const code = params['code'];
      const state = params['state'];
      const error = params['error'];

      if (error) {
        throw new Error(`Spotify authorization error: ${error}`);
      }

      if (!code || !state) {
        throw new Error('Missing authorization code or state');
      }

      await this.auth.handleCallback(code, state);

      // Redirect to home page on success
      this.router.navigate(['/']);

    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Une erreur inconnue est survenue';
      this.isLoading = false;
    }
  }

  retry(): void {
    this.error = null;
    this.isLoading = true;
    this.auth.login();
  }
}
