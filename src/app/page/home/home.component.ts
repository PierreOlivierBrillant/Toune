import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { SpotifyConnectComponent } from '../../component/spotify-connect/spotify-connect.component';
import { SpotifySearchComponent } from '../../component/spotify-search/spotify-search.component';
import { SpotifyAuthService } from '../../service/spotify-auth.service';

@Component({
  selector: 'app-home',
  imports: [SpotifyConnectComponent, SpotifySearchComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  auth = inject(SpotifyAuthService);
}
