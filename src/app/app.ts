import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UserProfileComponent } from './component/user-profile/user-profile.component';
import { SignalRService } from './service/signalr.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UserProfileComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private signalRService = inject(SignalRService);
}
