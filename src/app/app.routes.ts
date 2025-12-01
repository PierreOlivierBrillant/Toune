import { Routes } from '@angular/router';
import { SpotifyCallbackComponent } from './page/spotify-callback/spotify-callback.component';
import { HomeComponent } from './page/home/home.component';
import { authGuard } from './guard/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    pathMatch: 'full',
  },
  {
    path: 'callback',
    component: SpotifyCallbackComponent,
  },
  {
    path: 'admin',
    loadComponent: () => import('./page/admin/admin.component').then(m => m.AdminComponent),
    canActivate: [authGuard],
  },
];
