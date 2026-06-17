import { Directive, ElementRef, effect, inject, input } from '@angular/core';

/**
 * Animated number counter. Counts from 0 → value with an ease-out curve.
 * Usage: <span [appCountUp]="128"></span>  ·  [appCountUp]="86" suffix="%"
 * Respects prefers-reduced-motion (renders the final value instantly).
 */
@Directive({
  selector: '[appCountUp]',
  standalone: true,
})
export class CountUpDirective {
  private el = inject(ElementRef<HTMLElement>);

  value = input(0, { alias: 'appCountUp' });
  duration = input(1000);
  decimals = input(0);
  suffix = input('');
  prefix = input('');

  private frame = 0;

  constructor() {
    effect(() => {
      const target = Number(this.value()) || 0;
      const duration = this.duration();
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

      if (reduce || duration <= 0) {
        this.render(target);
        return;
      }

      cancelAnimationFrame(this.frame);
      const start = performance.now();
      const from = 0;

      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
        this.render(from + (target - from) * eased);
        if (t < 1) this.frame = requestAnimationFrame(tick);
        else this.render(target);
      };
      this.frame = requestAnimationFrame(tick);
    });
  }

  private render(n: number): void {
    this.el.nativeElement.textContent =
      this.prefix() + n.toFixed(this.decimals()) + this.suffix();
  }
}
