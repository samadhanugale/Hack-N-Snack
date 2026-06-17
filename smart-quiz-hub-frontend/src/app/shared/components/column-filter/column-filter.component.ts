import { Component, input, output } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { FilterOption } from '../../utils/table-ops';

/**
 * Compact per-column filter: a funnel icon that opens a single-select menu.
 * Highlighted when a value is active. Emits null for "All".
 */
@Component({
  selector: 'app-column-filter',
  standalone: true,
  imports: [MatMenuModule],
  template: `
    <button type="button" [matMenuTriggerFor]="menu" (click)="$event.stopPropagation()"
            [class]="'press relative inline-flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200 ' +
              (selected() != null ? 'text-indigo-600 bg-indigo-50 ring-1 ring-inset ring-indigo-200' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100')"
            [attr.aria-label]="'Filter ' + label()"
            [attr.aria-pressed]="selected() != null">
      <span class="material-icons text-[15px]">{{ selected() != null ? 'filter_alt' : 'filter_list' }}</span>
      @if (selected() != null) {
        <span class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-white animate-pop"></span>
      }
    </button>

    <mat-menu #menu="matMenu" class="filter-menu">
      <button mat-menu-item (click)="pick(null)"
              [class]="selected() == null ? '!text-indigo-600 !font-semibold' : ''">
        <span class="material-icons text-[16px] mr-2 align-middle text-indigo-600" [class.opacity-0]="selected() != null">check</span>
        <span class="align-middle">All</span>
      </button>
      @for (o of options(); track o.value) {
        <button mat-menu-item (click)="pick(o.value)"
                [class]="selected() === o.value ? '!text-indigo-600 !font-semibold' : ''">
          <span class="material-icons text-[16px] mr-2 align-middle text-indigo-600" [class.opacity-0]="selected() !== o.value">check</span>
          <span class="align-middle">{{ o.label }}</span>
        </button>
      }
    </mat-menu>
  `,
})
export class ColumnFilterComponent {
  label = input('');
  options = input<FilterOption[]>([]);
  selected = input<string | null>(null);
  selectedChange = output<string | null>();

  pick(value: string | null): void {
    this.selectedChange.emit(value);
  }
}
