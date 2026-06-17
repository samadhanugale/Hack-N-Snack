import { Directive, HostBinding, input } from '@angular/core';

export type ButtonVariant =
  | 'primary'    // main CTA — indigo→violet gradient
  | 'secondary'  // neutral outline
  | 'success'    // approve / positive
  | 'danger'     // destructive / reject
  | 'warning'    // submit / assign (amber)
  | 'accent'     // suggest / alternate (violet)
  | 'soft'       // low-emphasis tinted
  | 'ghost';     // text-only

export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

// Motion-design buttons: vibrant gradients that sweep on hover, glossy inset highlight,
// colored glow, lift + tactile press.
const BASE =
  'relative inline-flex items-center justify-center gap-2 font-semibold rounded-xl ' +
  'transition-all duration-300 ease-out whitespace-nowrap select-none ' +
  'hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:hover:translate-y-0 disabled:active:scale-100';

const SIZES: Record<ButtonSize, string> = {
  sm:        'h-9 px-4 text-xs',
  md:        'h-11 px-5 text-sm',
  lg:        'h-12 px-6 text-[15px]',
  icon:      'h-10 w-10 p-0 rounded-xl',
  'icon-sm': 'h-8 w-8 p-0 rounded-lg',
};

// Glossy top highlight + animated gradient sweep shared by all filled (gradient) variants.
const FILL = 'ring-1 ring-inset ring-white/20 text-white bg-[length:200%_auto] bg-left hover:bg-right';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:   `${FILL} bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 shadow-lg shadow-indigo-500/40 hover:shadow-xl hover:shadow-violet-500/50`,
  success:   `${FILL} bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 shadow-lg shadow-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/50`,
  danger:    `${FILL} bg-gradient-to-r from-rose-500 via-red-500 to-orange-500 shadow-lg shadow-rose-500/40 hover:shadow-xl hover:shadow-rose-500/50`,
  warning:   `${FILL} bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 shadow-lg shadow-amber-500/40 hover:shadow-xl hover:shadow-amber-500/50`,
  accent:    `${FILL} bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-500 shadow-lg shadow-violet-500/40 hover:shadow-xl hover:shadow-fuchsia-500/50`,
  secondary: 'text-slate-700 bg-white border border-slate-200 shadow-sm hover:border-indigo-300 hover:text-indigo-700 hover:shadow-md hover:shadow-indigo-500/10',
  soft:      'text-indigo-700 bg-indigo-100/70 ring-1 ring-inset ring-indigo-200/70 hover:bg-indigo-100',
  ghost:     'text-slate-500 bg-transparent hover:bg-slate-100 hover:text-slate-700',
};

/**
 * Consistent, modern button styling applied to any native <button> or <a>.
 * Usage: <button appBtn="primary">Save</button> · <button appBtn="ghost" size="icon">…
 * Static layout classes on the element (e.g. w-full) are preserved.
 */
@Directive({
  selector: '[appBtn]',
  standalone: true,
})
export class ButtonDirective {
  variant = input<ButtonVariant | ''>('primary', { alias: 'appBtn' });
  size = input<ButtonSize>('md');

  @HostBinding('class')
  get classes(): string {
    const variant = this.variant() || 'primary';
    return `${BASE} ${SIZES[this.size()]} ${VARIANTS[variant]}`;
  }
}
