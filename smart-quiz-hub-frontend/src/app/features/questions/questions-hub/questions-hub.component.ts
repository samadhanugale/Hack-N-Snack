import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { MyQuestionsComponent } from '../my-questions/my-questions.component';
import { QuestionBankComponent } from '../../admin/question-bank/question-bank.component';

type QTab = 'mine' | 'all';

/**
 * Unified Questions screen. SMEs see only their own questions; admins get a
 * "My Questions / Question Bank" toggle that swaps between the two existing views.
 */
@Component({
  selector: 'app-questions-hub',
  standalone: true,
  imports: [MyQuestionsComponent, QuestionBankComponent],
  template: `
    @if (auth.isAdmin()) {
      <div class="inline-flex gap-1 card p-1.5 mb-5 animate-fade-up" role="tablist" aria-label="Questions scope">
        @for (t of tabs; track t.id) {
          <button type="button" role="tab" [attr.aria-selected]="tab() === t.id" (click)="tab.set(t.id)"
                  [class]="'press inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ' +
                           (tab() === t.id ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-50')">
            <span class="material-icons text-[18px]" aria-hidden="true">{{ t.icon }}</span>
            <span>{{ t.label }}</span>
          </button>
        }
      </div>
    }

    @if (auth.isAdmin() && tab() === 'all') {
      <app-question-bank />
    } @else {
      <app-my-questions />
    }
  `,
})
export class QuestionsHubComponent {
  auth = inject(AuthService);
  tab = signal<QTab>(this.auth.isAdmin() ? 'all' : 'mine');

  tabs: { id: QTab; label: string; icon: string }[] = [
    { id: 'all',  label: 'Question Bank', icon: 'library_books' },
    { id: 'mine', label: 'My Questions',  icon: 'person' },
  ];
}
