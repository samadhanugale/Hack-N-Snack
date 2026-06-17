import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StackService } from '../../../core/services/stack.service';
import { StackDetail, TopicDetail } from '../../../core/models';
import { ButtonDirective } from '../../../shared/components/button/button.directive';

@Component({
  selector: 'app-stack-management',
  standalone: true,
  imports: [FormsModule, ButtonDirective],
  template: `
    <div class="animate-fade-up">

      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">Stack & Topic Management</h1>
          <p class="text-slate-500 text-sm mt-1">Manage technology stacks and their topics</p>
        </div>
        <button (click)="openStackForm()" appBtn="primary">
          <span class="material-icons text-[17px]" aria-hidden="true">add</span>
          New Stack
        </button>
      </div>

      <!-- Stats strip -->
      @if (!loading() && stacks().length > 0) {
        <div class="grid grid-cols-3 gap-3 mb-6">
          <div class="bg-white border border-slate-200 rounded-2xl px-4 py-3.5 shadow-sm">
            <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Stacks</p>
            <p class="text-2xl font-extrabold text-slate-900 mt-0.5">{{ stacks().length }}</p>
          </div>
          <div class="bg-white border border-slate-200 rounded-2xl px-4 py-3.5 shadow-sm">
            <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active</p>
            <p class="text-2xl font-extrabold text-emerald-600 mt-0.5">{{ activeStacks() }}</p>
          </div>
          <div class="bg-white border border-slate-200 rounded-2xl px-4 py-3.5 shadow-sm">
            <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Topics</p>
            <p class="text-2xl font-extrabold text-indigo-600 mt-0.5">{{ totalTopics() }}</p>
          </div>
        </div>

        <!-- Search + status filter -->
        <div class="flex items-center gap-3 mb-6 flex-wrap">
          <div class="relative flex-1 min-w-[220px]">
            <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]" aria-hidden="true">search</span>
            <input [ngModel]="search()" (ngModelChange)="search.set($event)"
                   aria-label="Search stacks"
                   placeholder="Search stacks…"
                   class="w-full h-10 pl-10 pr-4 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all" />
          </div>
          <div class="inline-flex rounded-xl border border-slate-200 bg-white p-1">
            @for (opt of [{ v: 'all', l: 'All' }, { v: 'active', l: 'Active' }, { v: 'inactive', l: 'Inactive' }]; track opt.v) {
              <button (click)="statusFilter.set($any(opt.v))"
                      class="px-3.5 h-8 rounded-lg text-xs font-semibold transition-all"
                      [class]="statusFilter() === opt.v ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'">
                {{ opt.l }}
              </button>
            }
          </div>
        </div>
      }

      @if (loading()) {
        <div class="flex items-center justify-center py-32">
          <svg class="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
        </div>
      } @else if (stacks().length === 0) {
        <div class="bg-white border border-slate-200 rounded-2xl py-20 flex flex-col items-center gap-4 text-center">
          <div class="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
            <span class="material-icons text-indigo-400 text-3xl" aria-hidden="true">layers</span>
          </div>
          <div>
            <p class="text-slate-800 font-semibold">No stacks yet</p>
            <p class="text-slate-400 text-sm mt-1">Create your first technology stack to get started</p>
          </div>
          <button (click)="openStackForm()" appBtn="primary" class="mt-1">
            <span class="material-icons text-[17px]" aria-hidden="true">add</span> New Stack
          </button>
        </div>
      } @else {

        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
          @for (stack of filteredStacks(); track stack.id) {
            <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden"
                 [class.opacity-60]="!stack.active">

              <!-- Stack header -->
              <div class="flex items-start gap-3 px-5 py-4 border-b border-slate-100">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <h3 class="font-bold text-slate-900 text-sm">{{ stack.stackName }}</h3>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          [class]="stack.active
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'">
                      {{ stack.active ? 'Active' : 'Inactive' }}
                    </span>
                  </div>
                  @if (stack.description) {
                    <p class="text-xs text-slate-400 mt-0.5 truncate">{{ stack.description }}</p>
                  }
                  <p class="text-[11px] text-slate-400 mt-1">{{ stack.topics.length }} topic{{ stack.topics.length !== 1 ? 's' : '' }}</p>
                </div>
                <div class="flex items-center gap-1 flex-shrink-0">
                  <button (click)="openStackForm(stack)"
                          class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
                          title="Edit stack" aria-label="Edit stack">
                    <span class="material-icons text-[16px]" aria-hidden="true">edit</span>
                  </button>
                  <button (click)="toggleStack(stack)"
                          class="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                          [class]="stack.active ? 'text-slate-400 hover:text-amber-600' : 'text-slate-400 hover:text-emerald-600'"
                          [title]="stack.active ? 'Deactivate' : 'Activate'"
                          [attr.aria-label]="stack.active ? 'Deactivate stack' : 'Activate stack'">
                    <span class="material-icons text-[16px]" aria-hidden="true">{{ stack.active ? 'toggle_on' : 'toggle_off' }}</span>
                  </button>
                </div>
              </div>

              <!-- Topics list -->
              <div class="px-5 py-3 space-y-1.5 max-h-52 overflow-y-auto">
                @if (stack.topics.length === 0) {
                  <p class="text-xs text-slate-400 text-center py-4">No topics yet</p>
                }
                @for (topic of stack.topics; track topic.id) {
                  <div class="flex items-center gap-2 px-3 py-2 rounded-xl"
                       [class]="topic.active ? 'bg-slate-50' : 'bg-slate-50 opacity-50'">
                    <span class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          [class]="topic.active ? 'bg-emerald-400' : 'bg-slate-300'"></span>
                    <span class="text-xs text-slate-700 flex-1 min-w-0 truncate">{{ topic.topicName }}</span>
                    <div class="flex items-center gap-0.5 flex-shrink-0">
                      <button (click)="openTopicForm(stack, topic)"
                              class="p-1 rounded-lg hover:bg-white text-slate-400 hover:text-indigo-600 transition-colors"
                              title="Edit topic" aria-label="Edit topic">
                        <span class="material-icons text-[13px]" aria-hidden="true">edit</span>
                      </button>
                      <button (click)="toggleTopic(stack, topic)"
                              class="p-1 rounded-lg hover:bg-white transition-colors"
                              [class]="topic.active ? 'text-slate-400 hover:text-amber-500' : 'text-slate-400 hover:text-emerald-500'"
                              [title]="topic.active ? 'Deactivate' : 'Activate'"
                              [attr.aria-label]="topic.active ? 'Deactivate topic' : 'Activate topic'">
                        <span class="material-icons text-[13px]" aria-hidden="true">{{ topic.active ? 'toggle_on' : 'toggle_off' }}</span>
                      </button>
                    </div>
                  </div>
                }
              </div>

              <!-- Add topic -->
              <div class="px-5 pb-4 pt-2 border-t border-slate-100">
                <button (click)="openTopicForm(stack)"
                        class="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
                  <span class="material-icons text-[14px]" aria-hidden="true">add_circle_outline</span>
                  Add Topic
                </button>
              </div>

            </div>
          } @empty {
            <div class="col-span-full bg-white border border-slate-200 rounded-2xl py-16 text-center">
              <p class="text-slate-500 font-medium">No stacks match your search / filter</p>
              <button (click)="search.set(''); statusFilter.set('all')" class="mt-2 text-indigo-600 text-sm font-semibold hover:underline">Reset</button>
            </div>
          }
        </div>
      }

    </div>

    <!-- ─── Stack Modal ──────────────────────────────────────────────────────── -->
    @if (stackModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4"
           (click)="closeModals()">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
             role="dialog" aria-modal="true" aria-labelledby="stack-modal-title"
             (click)="$event.stopPropagation()">

          <h2 id="stack-modal-title" class="text-lg font-bold text-slate-900 mb-1">
            {{ editingStack() ? 'Edit Stack' : 'New Stack' }}
          </h2>
          <p class="text-sm text-slate-400 mb-5">Fill in the details below</p>

          <div class="space-y-4">
            <div>
              <label for="stack-name" class="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Stack Name <span class="text-rose-500">*</span>
              </label>
              <input id="stack-name" [(ngModel)]="stackForm.stackName"
                     placeholder="e.g. Angular, Spring Boot, PostgreSQL"
                     class="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all" />
            </div>
            <div>
              <label for="stack-description" class="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Description
              </label>
              <textarea id="stack-description" [(ngModel)]="stackForm.description"
                        placeholder="Brief description (optional)"
                        rows="3"
                        class="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none"></textarea>
            </div>
          </div>

          <div class="flex justify-end gap-3 mt-6">
            <button (click)="closeModals()"
                    appBtn="secondary">
              Cancel
            </button>
            <button [disabled]="!stackForm.stackName.trim() || saving()"
                    (click)="saveStack()"
                    appBtn="primary">
              @if (saving()) {
                <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              }
              {{ editingStack() ? 'Save Changes' : 'Create Stack' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ─── Topic Modal ───────────────────────────────────────────────────────── -->
    @if (topicModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4"
           (click)="closeModals()">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
             role="dialog" aria-modal="true" aria-labelledby="topic-modal-title"
             (click)="$event.stopPropagation()">

          <h2 id="topic-modal-title" class="text-lg font-bold text-slate-900 mb-1">
            {{ editingTopic() ? 'Edit Topic' : 'New Topic' }}
          </h2>
          <p class="text-sm text-slate-400 mb-5">
            Stack: <span class="font-semibold text-slate-600">{{ targetStack()?.stackName }}</span>
          </p>

          <div>
            <label for="topic-name" class="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Topic Name <span class="text-rose-500">*</span>
            </label>
            <input id="topic-name" [(ngModel)]="topicForm.topicName"
                   placeholder="e.g. Components, Dependency Injection"
                   class="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all" />
          </div>

          <div class="flex justify-end gap-3 mt-6">
            <button (click)="closeModals()"
                    appBtn="secondary">
              Cancel
            </button>
            <button [disabled]="!topicForm.topicName.trim() || saving()"
                    (click)="saveTopic()"
                    appBtn="primary">
              @if (saving()) {
                <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              }
              {{ editingTopic() ? 'Save Changes' : 'Add Topic' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: []
})
export class StackManagementComponent implements OnInit {
  private stackService = inject(StackService);
  private snackBar = inject(MatSnackBar);

  stacks = signal<StackDetail[]>([]);
  loading = signal(true);
  saving = signal(false);

  search = signal('');
  statusFilter = signal<'all' | 'active' | 'inactive'>('all');

  totalTopics  = computed(() => this.stacks().reduce((n, s) => n + s.topics.length, 0));
  activeStacks = computed(() => this.stacks().filter(s => s.active).length);
  filteredStacks = computed(() => {
    const q = this.search().trim().toLowerCase();
    const sf = this.statusFilter();
    return this.stacks().filter(s => {
      if (sf === 'active' && !s.active) return false;
      if (sf === 'inactive' && s.active) return false;
      if (q && !s.stackName.toLowerCase().includes(q) && !(s.description ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  });

  stackModal = signal(false);
  topicModal = signal(false);

  editingStack = signal<StackDetail | null>(null);
  editingTopic = signal<TopicDetail | null>(null);
  targetStack = signal<StackDetail | null>(null);

  stackForm = { stackName: '', description: '' };
  topicForm = { topicName: '' };

  ngOnInit(): void {
    this.loadStacks();
  }

  loadStacks(): void {
    this.stackService.getAllStacksAdmin().subscribe({
      next: res => { this.stacks.set(res.data); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  openStackForm(stack?: StackDetail): void {
    this.editingStack.set(stack ?? null);
    this.stackForm = { stackName: stack?.stackName ?? '', description: stack?.description ?? '' };
    this.stackModal.set(true);
  }

  openTopicForm(stack: StackDetail, topic?: TopicDetail): void {
    this.targetStack.set(stack);
    this.editingTopic.set(topic ?? null);
    this.topicForm = { topicName: topic?.topicName ?? '' };
    this.topicModal.set(true);
  }

  closeModals(): void {
    this.stackModal.set(false);
    this.topicModal.set(false);
    this.editingStack.set(null);
    this.editingTopic.set(null);
    this.targetStack.set(null);
  }

  saveStack(): void {
    const name = this.stackForm.stackName.trim();
    if (!name) return;
    this.saving.set(true);
    const req = { stackName: name, description: this.stackForm.description.trim() || undefined };
    const editing = this.editingStack();
    const call = editing
      ? this.stackService.updateStack(editing.id, req)
      : this.stackService.createStack(req);

    call.subscribe({
      next: res => {
        if (editing) {
          this.stacks.update(list => list.map(s => s.id === res.data.id ? res.data : s));
        } else {
          this.stacks.update(list => [...list, res.data]);
        }
        this.saving.set(false);
        this.closeModals();
        this.snackBar.open(editing ? 'Stack updated' : 'Stack created', '', { duration: 3000 });
      },
      error: err => {
        this.saving.set(false);
        this.snackBar.open(err.error?.message ?? 'Failed to save stack', '', { duration: 4000 });
      }
    });
  }

  toggleStack(stack: StackDetail): void {
    this.stackService.toggleStack(stack.id).subscribe({
      next: res => {
        this.stacks.update(list => list.map(s => s.id === res.data.id ? res.data : s));
        this.snackBar.open(`Stack ${res.data.active ? 'activated' : 'deactivated'}`, '', { duration: 3000 });
      },
      error: () => this.snackBar.open('Failed to update stack', '', { duration: 4000 })
    });
  }

  saveTopic(): void {
    const name = this.topicForm.topicName.trim();
    const stack = this.targetStack();
    if (!name || !stack) return;
    this.saving.set(true);
    const req = { topicName: name };
    const editing = this.editingTopic();
    const call = editing
      ? this.stackService.updateTopic(stack.id, editing.id, req)
      : this.stackService.addTopic(stack.id, req);

    call.subscribe({
      next: res => {
        this.stacks.update(list => list.map(s => {
          if (s.id !== stack.id) return s;
          const topics = editing
            ? s.topics.map(t => t.id === res.data.id ? res.data : t)
            : [...s.topics, res.data];
          return { ...s, topics };
        }));
        this.saving.set(false);
        this.closeModals();
        this.snackBar.open(editing ? 'Topic updated' : 'Topic added', '', { duration: 3000 });
      },
      error: err => {
        this.saving.set(false);
        this.snackBar.open(err.error?.message ?? 'Failed to save topic', '', { duration: 4000 });
      }
    });
  }

  toggleTopic(stack: StackDetail, topic: TopicDetail): void {
    this.stackService.toggleTopic(stack.id, topic.id).subscribe({
      next: res => {
        this.stacks.update(list => list.map(s => {
          if (s.id !== stack.id) return s;
          return { ...s, topics: s.topics.map(t => t.id === res.data.id ? res.data : t) };
        }));
        this.snackBar.open(`Topic ${res.data.active ? 'activated' : 'deactivated'}`, '', { duration: 3000 });
      },
      error: () => this.snackBar.open('Failed to update topic', '', { duration: 4000 })
    });
  }
}
