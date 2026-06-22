import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { McqResponse, SmeUserResponse } from '../../../core/models';

export interface AssignReviewerDialogData {
  /** Single-question mode */
  question?: McqResponse;
  /** Bulk mode: number of selected questions */
  bulkCount?: number;
  smes: SmeUserResponse[];
}

@Component({
  selector: 'app-assign-reviewer-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, FormsModule],
  template: `
    <div mat-dialog-title class="px-6 pt-6 pb-0 animate-scale-in">
      <h2 class="text-xl font-bold text-slate-900">Assign Reviewer</h2>
      <p class="text-slate-400 text-sm mt-1">Search and select an SME to review</p>
    </div>

    <mat-dialog-content class="px-6 pt-4 pb-2" style="min-width:460px; max-height:520px">

      <!-- Context preview -->
      @if (isBulk) {
        <div class="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mb-5">
          <span class="material-icons text-indigo-400 text-[18px]">checklist</span>
          <p class="text-sm text-indigo-700 font-medium">
            Assigning reviewer to
            <span class="font-bold">{{ data.bulkCount }} question{{ data.bulkCount !== 1 ? 's' : '' }}</span>
          </p>
        </div>
      } @else {
        <div class="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-5">
          <span class="material-icons text-indigo-400 text-[16px] mt-0.5 flex-shrink-0">quiz</span>
          <p class="text-sm text-slate-500 leading-relaxed">
            {{ data.question!.questionStem.slice(0, 130) }}{{ data.question!.questionStem.length > 130 ? '…' : '' }}
          </p>
        </div>
      }

      <label class="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
        Select Reviewer
        <span class="ml-1 text-slate-400 normal-case font-normal">({{ filteredSmes.length }} available)</span>
      </label>

      <!-- Search input -->
      <div class="relative mb-3">
        <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
        <input [(ngModel)]="searchQuery"
               placeholder="Search by name or enterprise ID…"
               class="field w-full pl-10 pr-9 py-2.5 text-sm text-slate-800" />
        @if (searchQuery) {
          <button (click)="searchQuery = ''"
                  class="press absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
            <span class="material-icons text-[16px]">close</span>
          </button>
        }
      </div>

      <!-- SME list -->
      <div class="border border-slate-200 rounded-xl overflow-hidden">
        @if (filteredSmes.length === 0) {
          <div class="flex flex-col items-center gap-2 py-8 text-center">
            <span class="material-icons text-slate-300 text-3xl">person_search</span>
            <p class="text-sm text-slate-400">No SMEs match "{{ searchQuery }}"</p>
          </div>
        } @else {
          <div class="max-h-52 overflow-y-auto divide-y divide-slate-100">
            @for (sme of filteredSmes; track sme.id) {
              <div (click)="selectedId = sme.id"
                   class="flex items-center gap-3 px-4 py-3 cursor-pointer transition-all"
                   [class]="selectedId === sme.id
                     ? 'bg-indigo-50 border-l-2 border-l-indigo-500'
                     : 'hover:bg-slate-50 border-l-2 border-l-transparent'">

                <div class="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                     [class]="selectedId === sme.id
                       ? 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm'
                       : 'bg-slate-100 text-slate-500'">
                  {{ sme.fullName.charAt(0) }}
                </div>

                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold truncate"
                     [class]="selectedId === sme.id ? 'text-indigo-700' : 'text-slate-800'">
                    {{ sme.fullName }}
                  </p>
                  <p class="text-xs text-slate-400 mt-0.5">{{ sme.enterpriseId }}</p>
                </div>

                <div class="flex gap-1 flex-wrap justify-end max-w-[140px]">
                  @for (stack of sme.stacks.slice(0, 2); track stack.id) {
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          [class]="selectedId === sme.id
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-slate-100 text-slate-500'">
                      {{ stack.stackName }}
                    </span>
                  }
                  @if (sme.stacks.length > 2) {
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-400">
                      +{{ sme.stacks.length - 2 }}
                    </span>
                  }
                </div>

                @if (selectedId === sme.id) {
                  <span class="material-icons text-indigo-500 text-[20px] flex-shrink-0">check_circle</span>
                }
              </div>
            }
          </div>
        }
      </div>

      @if (selectedSme) {
        <div class="animate-pop flex items-center gap-2 mt-3 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl">
          <span class="material-icons text-indigo-500 text-[16px]">person_check</span>
          <p class="text-sm text-indigo-700 font-medium">
            <span class="font-bold">{{ selectedSme!.fullName }}</span> will be assigned as reviewer
            @if (isBulk) { <span class="font-normal">for {{ data.bulkCount }} question{{ data.bulkCount !== 1 ? 's' : '' }}</span> }
          </p>
        </div>
      }

    </mat-dialog-content>

    <mat-dialog-actions class="px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
      <button mat-dialog-close
              class="press px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all">
        Cancel
      </button>
      <button [disabled]="!selectedId" (click)="dialogRef.close(selectedId)"
              class="press flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold shadow-lg shadow-indigo-500/25 disabled:opacity-60 disabled:cursor-not-allowed transition-all">
        <span class="material-icons text-[17px]">person_add</span>
        {{ isBulk ? 'Assign to ' + data.bulkCount + ' Questions' : 'Assign Reviewer' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: []
})
export class AssignReviewerDialogComponent {
  selectedId: number | null = null;
  searchQuery = '';

  get isBulk(): boolean {
    return !!this.data.bulkCount;
  }

  get filteredSmes(): SmeUserResponse[] {
    const q = this.searchQuery.toLowerCase().trim();
    return this.eligibleSmes.filter(s =>
      !q ||
      s.fullName.toLowerCase().includes(q) ||
      s.enterpriseId.toLowerCase().includes(q)
    );
  }

  get selectedSme(): SmeUserResponse | null {
    return this.selectedId
      ? this.eligibleSmes.find(s => s.id === this.selectedId) ?? null
      : null;
  }

  get eligibleSmes(): SmeUserResponse[] {
    // In bulk mode all SMEs are eligible (backend enforces creator-can't-review-own)
    if (this.isBulk) return this.data.smes;
    return this.data.smes.filter(s => s.id !== this.data.question?.creatorId);
  }

  constructor(
    public dialogRef: MatDialogRef<AssignReviewerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AssignReviewerDialogData
  ) {}
}
