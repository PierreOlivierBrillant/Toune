import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { SpotifyAuthService } from '../../service/spotify-auth.service';

@Component({
    selector: 'spotify-connect',
    templateUrl: './spotify-connect.component.html',
    styleUrl: './spotify-connect.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpotifyConnectComponent {
    auth = inject(SpotifyAuthService);

    connect(): void {
        this.auth.login();
    }
}
