import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Gestion globale des erreurs pour filtrer les erreurs du SDK Spotify
window.addEventListener('error', (event) => {
  // Filtrer les erreurs "Script error" qui proviennent du SDK Spotify
  if (event.message === 'Script error.' || 
      event.filename?.includes('spotify-player.js') || 
      event.filename?.includes('scdn.co')) {
    // Empêcher l'affichage de ces erreurs dans la console
    event.preventDefault();
    return false;
  }
  return true;
});

// Filtrer les avertissements de console spécifiques au SDK Spotify
const originalConsoleWarn = console.warn;
console.warn = function(...args: any[]) {
  // Filtrer l'avertissement de robustesse du SDK Spotify
  if (args.length > 0 && typeof args[0] === 'string' && 
      args[0].includes('robustness level')) {
    return; // Ne pas afficher cet avertissement
  }
  originalConsoleWarn.apply(console, args);
};

// Gestion des promesses rejetées non capturées
window.addEventListener('unhandledrejection', (event) => {
  // Filtrer les erreurs du SDK Spotify
  if (event.reason?.message?.includes('spotify') || 
      event.reason?.stack?.includes('spotify-player.js')) {
    // Empêcher l'affichage de ces erreurs
    event.preventDefault();
    return false;
  }
  return true;
});

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
