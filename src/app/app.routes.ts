import { Routes } from '@angular/router';
import { SpotifyCallbackComponent } from './page/spotify-callback/spotify-callback.component';
import { HomeComponent } from './page/home/home.component';
import { AdminComponent } from './page/admin/admin.component';
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
    component: AdminComponent,
    canActivate: [authGuard],
  },
];
