import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-coming-soon',
    imports: [RouterLink],
    templateUrl: './coming-soon.component.html',
    styleUrl: './coming-soon.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComingSoonComponent { }
