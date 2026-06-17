import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse, SmeUserResponse } from '../models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private base = `${environment.apiUrl}/admin`;

  private http = inject(HttpClient);

  getAllSmes(): Observable<ApiResponse<SmeUserResponse[]>> {
    return this.http.get<ApiResponse<SmeUserResponse[]>>(`${this.base}/smes`);
  }

  getSmesByStack(stackId: number): Observable<ApiResponse<SmeUserResponse[]>> {
    return this.http.get<ApiResponse<SmeUserResponse[]>>(`${this.base}/stacks/${stackId}/smes`);
  }
}
