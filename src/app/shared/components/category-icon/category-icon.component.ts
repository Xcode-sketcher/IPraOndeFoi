import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';

@Component({
    selector: 'app-category-icon',
    standalone: true,
    imports: [CommonModule, SafeHtmlPipe],
    template: `
    <div [class]="containerClass" [innerHTML]="getSvg() | safeHtml"></div>
  `,
    styles: [`
    :host { display: contents; }
  `]
})
export class CategoryIconComponent {
    @Input() name: string = '';
    @Input() size: number = 24;
    @Input() strokeWidth: number = 2;
    @Input() containerClass: string = '';

    getSvg(): string {
        const n = (this.name || '').toLowerCase();
        const style = `width: ${this.size}px; height: ${this.size}px; stroke-width: ${this.strokeWidth};`;
        const common = `xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" style="${style}"`;

        // Mapeamento de Categorias
        if (n.includes('salário') || n.includes('receita') || n.includes('freelance') || n.includes('renda')) {
            // Wallet / Money
            return `<svg ${common}><path d="M21 12V7H5a2 2 0 0 1-2-2V5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-4a2 2 0 0 1 2-2h2z"/><line x1="16" y1="14" x2="16" y2="14.01"/></svg>`;
        }

        if (n.includes('aluguel') || n.includes('condomínio') || n.includes('casa') || n.includes('moradia')) {
            // Home
            return `<svg ${common}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
        }

        if (n.includes('alimentação') || n.includes('comida') || n.includes('mercado') || n.includes('restaurante')) {
            // Utensils
            return `<svg ${common}><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`;
        }

        if (n.includes('transporte') || n.includes('uber') || n.includes('combustível') || n.includes('carro')) {
            // Car
            return `<svg ${common}><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M5 17h12"/></svg>`;
        }

        if (n.includes('saúde') || n.includes('médico') || n.includes('farmácia') || n.includes('hospital')) {
            // Heart Pulse
            return `<svg ${common}><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`;
        }

        if (n.includes('educação') || n.includes('curso') || n.includes('escola') || n.includes('livro')) {
            // Book
            return `<svg ${common}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`;
        }

        if (n.includes('lazer') || n.includes('diversão') || n.includes('viagem') || n.includes('cinema')) {
            // Party / Confetti (Smile for now)
            return `<svg ${common}><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`;
        }

        if (n.includes('investimento') || n.includes('poupança')) {
            // Trending Up
            return `<svg ${common}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`;
        }

        if (n.includes('assinatura') || n.includes('netflix') || n.includes('spotify') || n.includes('serviço')) {
            // Credit Card
            return `<svg ${common}><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`;
        }

        if (n.includes('outro') || n.includes('diverso')) {
            // Tag
            return `<svg ${common}><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>`;
        }

        // Default: Shopping Bag
        return `<svg ${common}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`;
    }
}
