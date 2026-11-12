import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { toApiError } from '../models/api-error';
import { Credentials, Session, User } from '../models/user';
import { API_BASE_URL } from './api-config';

interface LoginResponseDto {
  readonly token: string;
  readonly expiresAt: string;
  readonly user: User;
}

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  login(credentials: Credentials): Observable<Session> {
    return this.http.post<LoginResponseDto>(`${this.baseUrl}/auth/login`, credentials).pipe(
      map((dto) => ({ token: dto.token, expiresAt: Date.parse(dto.expiresAt), user: dto.user })),
      catchError((error: unknown) => throwError(() => toApiError(error))),
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/auth/logout`, null).pipe(
      catchError((error: unknown) => throwError(() => toApiError(error))),
    );
  }
}
