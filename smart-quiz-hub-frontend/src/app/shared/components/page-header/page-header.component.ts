import { Component, input } from '@angular/core';

/**
 * Consistent page header used across every screen:
 *   <app-page-header icon="quiz" title="Questions" subtitle="...">
 *     <button appBtn="primary">Action</button>   <!-- projected, right-aligned -->
 *   </app-page-header>
 * Stacks the actions below the title on small screens.
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 animate-fade-up">
      <div class="flex items-center gap-3.5 min-w-0">
        @if (icon()) {
          <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/30">
            <span class="material-icons text-white text-[22px]" aria-hidden="true">{{ icon() }}</span>
          </div>
        }
        <div class="min-w-0">
          <h1 class="text-2xl font-extrabold text-slate-800 tracking-tight truncate">{{ title() }}</h1>
          @if (subtitle()) {
            <p class="text-slate-500 text-sm mt-0.5">{{ subtitle() }}</p>
          }
        </div>
      </div>
      <div class="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <ng-content />
      </div>
    </div>
  `,
})
export class PageHeaderComponent {
  icon = input('');
  title = input('');
  subtitle = input('');
}
