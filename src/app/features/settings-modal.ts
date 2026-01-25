import { Component, EventEmitter, inject, Output, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { ApiService, Tag } from '../core/api.service';
import { ThemeService } from '../core/theme.service';
import { PwaService } from '../core/pwa.service';
import { finalize, catchError, of } from 'rxjs';

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings-modal.html',
  styleUrl: './settings-modal.css',
})
export class SettingsModal implements OnInit {
  @Output() close = new EventEmitter<void>();

  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  protected readonly theme = inject(ThemeService);
  protected readonly pwa = inject(PwaService);

  protected readonly user = this.auth.currentUser;

  // State
  activeTab = signal<'perfil' | 'tags' | 'sistema'>('perfil');

  // Tags
  tags = signal<Tag[]>([]);
  newTagName = signal('');
  isAddingTag = signal(false);
  isLoadingTags = signal(false);
  tagError = signal<string | null>(null);
  tagSuccess = signal<string | null>(null);

  // Delete Tag Modal
  isDeleteTagModalOpen = signal(false);
  deletingTag = signal<Tag | null>(null);
  isDeletingTag = signal(false);

  // Logout
  isLoggingOut = signal(false);

  // PWA Install
  isInstalling = signal(false);
  installMessage = signal<string | null>(null);

  ngOnInit() {
    this.loadTags();
  }

  setTab(tab: 'perfil' | 'tags' | 'sistema') {
    this.activeTab.set(tab);
    this.tagError.set(null);
    this.tagSuccess.set(null);
    this.installMessage.set(null);
  }

  loadTags() {
    const user = this.user();
    if (user?.contaId) {
      this.isLoadingTags.set(true);
      this.api.getTags(user.contaId)
        .pipe(
          finalize(() => this.isLoadingTags.set(false)),
          catchError(() => {
            this.tagError.set('Erro ao carregar tags.');
            return of([]);
          })
        )
        .subscribe(tags => {
          this.tags.set(tags || []);
        });
    }
  }

  addTag() {
    const nome = this.newTagName().trim();
    const user = this.user();

    if (!nome) {
      return;
    }
    if (!user?.contaId) {
      return;
    }

    this.tagError.set(null);
    this.tagSuccess.set(null);
    this.isAddingTag.set(true);

    this.api.criarTag({ contaId: user.contaId, nome }).pipe(
      finalize(() => this.isAddingTag.set(false)),
      catchError(() => {
        this.tagError.set('Erro ao criar tag. Verifique sua conexão.');
        return of(null);
      })
    ).subscribe({
      next: (res) => {
        if (res !== null) {
          this.newTagName.set('');
          this.tagSuccess.set(`Tag "${nome}" criada!`);
          this.loadTags();
        }
      }
    });
  }

  // Open Delete Modal
  openDeleteTagModal(tag: Tag) {
    this.deletingTag.set(tag);
    this.isDeleteTagModalOpen.set(true);
  }

  closeDeleteTagModal() {
    this.isDeleteTagModalOpen.set(false);
    this.deletingTag.set(null);
  }

  confirmDeleteTag() {
    const tag = this.deletingTag();
    if (!tag) return;

    this.isDeletingTag.set(true);
    this.tagError.set(null);

    this.api.deletarTag(tag.id).pipe(
      finalize(() => this.isDeletingTag.set(false)),
      catchError(() => {
        this.tagError.set('Erro ao excluir tag.');
        return of(null);
      })
    ).subscribe({
      next: () => {
        this.tagSuccess.set(`Tag "${tag.nome}" excluída!`);
        this.loadTags();
        this.closeDeleteTagModal();
      }
    });
  }

  handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.addTag();
    }
  }

  logout() {
    if (this.isLoggingOut()) return;
    this.isLoggingOut.set(true);
    this.auth.logout().pipe(
      finalize(() => this.isLoggingOut.set(false))
    ).subscribe();
  }

  // PWA Install
  async installPwa() {
    if (this.isInstalling()) return;

    this.isInstalling.set(true);
    this.installMessage.set(null);

    try {
      const result = await this.pwa.install();

      if (result === 'accepted') {
        this.installMessage.set('✅ App instalado com sucesso!');
      } else if (result === 'dismissed') {
        this.installMessage.set('Instalação cancelada pelo usuário.');
      } else {
        // Show manual instructions
        this.installMessage.set(this.pwa.getManualInstallInstructions());
      }
    } catch (err) {
      this.installMessage.set(this.pwa.getManualInstallInstructions());
    } finally {
      this.isInstalling.set(false);
    }
  }

  closeModal() {
    this.close.emit();
  }
}
