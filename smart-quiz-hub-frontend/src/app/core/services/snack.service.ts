import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class SnackService {
  private snack = inject(MatSnackBar);

  success(msg: string): void {
    this.snack.open(msg, 'Close', {
      duration: 4000,
      panelClass: ['snack-success'],
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }

  error(msg: string): void {
    this.snack.open(msg, 'Close', {
      duration: 6000,
      panelClass: ['snack-error'],
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }
}
