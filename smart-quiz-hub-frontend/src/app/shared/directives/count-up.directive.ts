import { Directive, ElementRef, Input, OnChanges, inject } from '@angular/core';

/**
 * Animated number counter. Counts from 0 → value with an ease-out curve.
 * Usage: <span [appCountUp]="128"></span>  ·  [appCountUp]="86" suffix="%"
 * Respects prefers-reduced-motion (renders the final value instantly).
 */
@Directive({
  selector: '[appCountUp]',
  standalone: true,
})
export class CountUpDirective implements OnChanges {
  private el = inject(ElementRef<HTMLElement>);

  @Input('appCountUp') value = 0;
  @Input() duration = 1000;
  @Input() decimals = 0;
  @Input() suffix = '';
  @Input() prefix = '';

  private frame = 0;

  ngOnChanges(): void {
    const target = Number(this.value) || 0;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduce || this.duration <= 0) {
      this.render(target);
      return;
    }

    cancelAnimationFrame(this.frame);
    const start = performance.now();
    const from = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / this.duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      this.render(from + (target - from) * eased);
      if (t < 1) this.frame = requestAnimationFrame(tick);
      else this.render(target);
    };
    this.frame = requestAnimationFrame(tick);
  }

  private render(n: number): void {
    this.el.nativeElement.textContent =
      this.prefix + n.toFixed(this.decimals) + this.suffix;
  }
}
