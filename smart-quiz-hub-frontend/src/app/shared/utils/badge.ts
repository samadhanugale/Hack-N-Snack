// Tailwind class helpers for status / difficulty badges (replaces global SCSS classes).
// Literal class strings live here so Tailwind's content scanner picks them up.

const BADGE_BASE = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset';

const STATUS_CLASSES: Record<string, string> = {
  DRAFT:                  'bg-slate-100 text-slate-600 ring-slate-200',
  READY_FOR_REVIEW:       'bg-amber-50 text-amber-700 ring-amber-200',
  UNDER_REVIEW:           'bg-blue-50 text-blue-700 ring-blue-200',
  MODIFICATION_REQUESTED: 'bg-violet-50 text-violet-700 ring-violet-200',
  APPROVED:               'bg-emerald-50 text-emerald-700 ring-emerald-200',
  REJECTED:               'bg-rose-50 text-rose-700 ring-rose-200',
};

const DIFF_CLASSES: Record<string, string> = {
  EASY:   'bg-emerald-50 text-emerald-700 ring-emerald-200',
  MEDIUM: 'bg-amber-50 text-amber-700 ring-amber-200',
  HARD:   'bg-rose-50 text-rose-700 ring-rose-200',
};

export function statusBadgeClass(status: string): string {
  return `${BADGE_BASE} ${STATUS_CLASSES[status] ?? 'bg-slate-100 text-slate-600'}`;
}

export function difficultyBadgeClass(difficulty: string): string {
  return `${BADGE_BASE} ${DIFF_CLASSES[difficulty] ?? 'bg-slate-100 text-slate-600'}`;
}

export function statusLabel(status: string): string {
  return status.replaceAll('_', ' ');
}
