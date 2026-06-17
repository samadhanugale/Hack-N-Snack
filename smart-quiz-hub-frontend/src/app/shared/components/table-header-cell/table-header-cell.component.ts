import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ColumnFilterComponent } from '../column-filter/column-filter.component';
import { FilterOption, SortState } from '../../utils/table-ops';

/**
 * One integrated, modern table-header cell: a clickable sort label (A→Z / Z→A)
 * with an optional inline filter funnel. Place the component's host inside a <th>.
 * Highlights indigo when the column is the active sort or has an active filter.
 */
@Component({
  selector: 'app-th-cell',
  standalone: true,
  imports: [ColumnFilterComponent],
  template: `
    <div class="flex items-center gap-0.5" [class.justify-end]="align === 'right'">
      @if (sortKey) {
        <button type="button" (click)="toggleSort()"
                [attr.aria-label]="'Sort by ' + label + (isSorted ? (dir === 'asc' ? ', ascending' : ', descending') : '')"
                [class]="'group inline-flex items-center gap-1.5 select-none text-[11px] font-bold uppercase tracking-wider rounded-lg px-2 py-1 -mx-1 transition-all duration-200 ' +
                  (isSorted ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100')">
          <span>{{ label }}</span>
          <span class="inline-flex items-center justify-center w-4 h-4 rounded-md transition-colors"
                [class]="isSorted ? 'bg-indigo-100 text-indigo-600' : 'text-slate-300 group-hover:text-slate-400'">
            <span class="material-icons text-[13px]"
                  [class.rotate-180]="isSorted && dir === 'desc'"
                  style="transition: transform .25s cubic-bezier(0.22,1,0.36,1)">
              {{ isSorted ? 'arrow_upward' : 'unfold_more' }}
            </span>
          </span>
        </button>
      } @else {
        <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500 px-1">{{ label }}</span>
      }

      @if (filterOptions) {
        <app-column-filter [label]="label" [options]="filterOptions"
                           [selected]="filterValue" (selectedChange)="filterChange.emit($event)" />
      }
    </div>
  `,
})
export class TableHeaderCellComponent {
  @Input() label = '';
  @Input() sortKey = '';
  @Input() sort: SortState | null = null;
  @Input() filterOptions: FilterOption[] | null = null;
  @Input() filterValue: string | null = null;
  @Input() align: 'left' | 'right' = 'left';

  @Output() sortChange = new EventEmitter<SortState>();
  @Output() filterChange = new EventEmitter<string | null>();

  get isSorted(): boolean { return !!this.sortKey && this.sort?.key === this.sortKey; }
  get dir(): 'asc' | 'desc' { return this.sort?.dir ?? 'asc'; }

  toggleSort(): void {
    const dir: 'asc' | 'desc' = this.isSorted && this.sort!.dir === 'asc' ? 'desc' : 'asc';
    this.sortChange.emit({ key: this.sortKey, dir });
  }
}
