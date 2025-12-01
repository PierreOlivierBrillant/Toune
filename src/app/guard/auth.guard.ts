import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SpotifyAuthService } from '../service/spotify-auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(SpotifyAuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/']);
};
