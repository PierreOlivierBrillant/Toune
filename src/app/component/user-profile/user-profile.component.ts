import { Component, ChangeDetectionStrategy, inject, signal, OnInit, OnDestroy, effect } from '@angular/core';
import { SpotifyAuthService } from '../../service/spotify-auth.service';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';

interface SpotifyUser {
    id: string;
    display_name: string;
    email: string;
    images: Array<{ url: string; height: number; width: number }>;
    followers: { total: number };
    country: string;
}

@Component({
    selector: 'user-profile',
    templateUrl: './user-profile.component.html',
    styleUrl: './user-profile.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatIconModule, MatMenuModule, MatButtonModule, MatDividerModule]
})
export class UserProfileComponent implements OnInit, OnDestroy {
    auth = inject(SpotifyAuthService);

    userProfile = signal<SpotifyUser | null>(null);
    isLoading = signal(false);

    constructor() {
        // React to authentication changes
        effect(() => {
            if (this.auth.isAuthenticated() && this.auth.token()) {
                this.loadUserProfile();
            } else {
                this.userProfile.set(null);
            }
        });
    }

    ngOnInit(): void {
        // Initial load if already authenticated
        if (this.auth.isAuthenticated() && this.auth.token()) {
            this.loadUserProfile();
        }
    }

    ngOnDestroy(): void {
        // Cleanup is handled by effect automatically
    }

    private async loadUserProfile(): Promise<void> {
        if (!this.auth.token()) {
            return;
        }

        this.isLoading.set(true);

        try {
            const response = await fetch('https://api.spotify.com/v1/me', {
                headers: {
                    'Authorization': `Bearer ${this.auth.token()}`
                }
            });

            if (response.ok) {
                const user = await response.json();
                this.userProfile.set(user);
            }
        } catch (error) {
            // Silently ignore errors
        } finally {
            this.isLoading.set(false);
        }
    }

    logout(): void {
        this.auth.logout();
        this.userProfile.set(null);
        // Reload page to reset app state
        window.location.reload();
    }

    getUserDisplayName(): string {
        const profile = this.userProfile();
        return profile?.display_name || profile?.id || 'Utilisateur';
    }

    getUserAvatar(): string | null {
        const profile = this.userProfile();
        return profile?.images?.[0]?.url || null;
    }

    getUserInitials(): string {
        const displayName = this.getUserDisplayName();
        return displayName
            .split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .substring(0, 2);
    }
}
