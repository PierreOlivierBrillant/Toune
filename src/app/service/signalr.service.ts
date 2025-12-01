import { Injectable, inject, signal } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';
import { environment } from '../../environments/environment';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface SpotifySubmission {
  spotifySongId: string;
  fullName: string;
  receivedAtUtc: string;
}

@Injectable({ providedIn: 'root' })
export class SignalRService {
  private hubConnection: HubConnection | null = null;
  private snackBar = inject(MatSnackBar);

  public isConnected = signal(false);
  public submissions = signal<SpotifySubmission[]>([]);

  constructor() {
    this.startConnection();
  }

  public startConnection = () => {
    this.hubConnection = new HubConnectionBuilder()
      .withUrl(environment.serverUrl + '/hubs/admin')
      .withAutomaticReconnect()
      .build();

    this.hubConnection
      .start()
      .then(() => {
        console.log('Connection started');
        this.isConnected.set(true);
      })
      .catch((err) => console.log('Error while starting connection: ' + err));

    this.hubConnection.on('SpotifySubmissionReceived', (submission: SpotifySubmission) => {
      this.submissions.update((current) => [...current, submission]);
      this.snackBar.open(`Nouvelle demande de ${submission.fullName}`, 'OK', {
        duration: 3000,
      });
    });

    this.hubConnection.onclose(() => {
      this.isConnected.set(false);
      this.snackBar.open('Déconnecté du serveur. Tentative de reconnexion...', undefined, {
        duration: 3000,
      });
    });

    this.hubConnection.onreconnecting(() => {
      this.isConnected.set(false);
    });

    this.hubConnection.onreconnected(() => {
      this.isConnected.set(true);
      this.snackBar.open('Reconnecté au serveur', undefined, {
        duration: 3000,
      });
    });
  };

  public async broadcastSpotifySubmission(trackId: string, userFullName: string) {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      await this.hubConnection.invoke('BroadcastSpotifySubmission', trackId, userFullName);
    } else {
      console.error("SignalR connection is not in the 'Connected' state");
      this.snackBar.open("Impossible d'envoyer la demande : pas de connexion au serveur", 'OK', {
        duration: 3000,
      });
    }
  }

  public async joinAdminGroup() {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      await this.hubConnection.invoke('JoinAdminGroup');
    } else {
      // Retry once connected
      const interval = setInterval(() => {
        if (this.hubConnection?.state === HubConnectionState.Connected) {
          this.hubConnection.invoke('JoinAdminGroup');
          clearInterval(interval);
        }
      }, 1000);
    }
  }

  public removeSubmission(submission: SpotifySubmission) {
    this.submissions.update((current) =>
      current.filter(
        (s) =>
          s.spotifySongId !== submission.spotifySongId ||
          s.receivedAtUtc !== submission.receivedAtUtc
      )
    );
  }

  public clearSubmissions() {
    this.submissions.set([]);
  }
}
