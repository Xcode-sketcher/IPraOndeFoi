import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SettingsModal } from '../features/settings-modal';

@Component({
    selector: 'app-shell',
    standalone: true,
    imports: [RouterLink, RouterLinkActive, RouterOutlet, SettingsModal],
    templateUrl: './shell.component.html',
    styleUrl: './shell.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShellComponent {
    protected readonly isSettingsOpen = signal(false);

    openSettings() {
        this.isSettingsOpen.set(true);
    }

    closeSettings() {
        this.isSettingsOpen.set(false);
    }
}
