// src/app/auth.service.ts
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, catchError, switchMap, map, of } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { CryptoService } from '../crypto.service';

export interface User {
  username: string;
  password: string;
  public_key?: string;
}

export interface AuthResponse {
  message: string;
  user_id?: number;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:5000'; // Your Flask backend URL
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  constructor(
    private http: HttpClient,
    private cryptoService: CryptoService
  ) { }

  register(user: User): Observable<AuthResponse> {
    // Only generate keys if in browser context
    if (!this.isBrowser) {
      return this.http.post<AuthResponse>(`${this.apiUrl}/register`, user);
    }

    // Generate a key pair before registration
    return from(this.cryptoService.generateKeyPair()).pipe(
      switchMap(keyPair => {
        // Store the private key in local storage
        localStorage.setItem('privateKey', keyPair.privateKey);
        
        // Send the public key to the server along with username and password
        const userWithPublicKey: User = {
          ...user,
          public_key: keyPair.publicKey
        };
        
        return this.http.post<AuthResponse>(`${this.apiUrl}/register`, userWithPublicKey);
      }),
      catchError(error => {
        console.error('Error during registration:', error);
        throw error;
      })
    );
  }

  login(user: User): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, user);
  }

  /**
   * Get the stored private key from localStorage
   * @returns The private key as a string or null if not found
   */
  getPrivateKey(): string | null {
    if (!this.isBrowser) {
      return null;
    }
    return localStorage.getItem('privateKey');
  }

  /**
   * Check if the user has a private key stored
   * @returns Boolean indicating if a private key exists
   */
  hasPrivateKey(): boolean {
    if (!this.isBrowser) {
      return false;
    }
    return localStorage.getItem('privateKey') !== null;
  }

  /**
   * Check if the user is logged in
   * @returns Boolean indicating if the user is logged in
   */
  isLoggedIn(): boolean {
    if (!this.isBrowser) {
      return false;
    }
    return localStorage.getItem('username') !== null && this.hasPrivateKey();
  }

  /**
   * Log out the user by removing stored credentials
   */
  logout(): void {
    if (!this.isBrowser) {
      return;
    }
    localStorage.removeItem('username');
    localStorage.removeItem('user_id');
    localStorage.removeItem('privateKey');
  }
}