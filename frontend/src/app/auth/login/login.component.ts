// src/app/login/login.component.ts
import { Component, OnInit, inject, PLATFORM_ID, Injectable } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { AuthService } from '../auth.service';

interface LoginResponse {
  message: string;
  user_id?: number;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, HttpClientModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  providers: [AuthService]
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  errorMessage: string = '';
  successMessage: string = '';
  isSubmitting: boolean = false;
  
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    // Skip localStorage checks if we're not in the browser
    if (!this.isBrowser) {
      return;
    }
    
    // Check if user is already logged in
    if (localStorage.getItem('username')) {
      this.router.navigate(['/home']);
      return;
    }

    // Check if user just registered successfully
    this.route.queryParams.subscribe(params => {
      if (params['registered'] === 'true') {
        this.successMessage = 'Registration successful! Please log in.';
      }
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    this.authService.login(this.loginForm.value).subscribe({
      next: (response: LoginResponse) => {
        console.log('Login successful', response);
        
        // Store username in localStorage if in browser
        if (this.isBrowser) {
          localStorage.setItem('username', this.loginForm.value.username);
          
          // Store user_id in localStorage if available
          if (response.user_id) {
            localStorage.setItem('user_id', response.user_id.toString());
          }
        }
        
        // Navigate to home after login
        this.router.navigate(['/home']);
      },
      error: (error) => {
        console.error('Login error', error);
        this.errorMessage = error.error?.error || 'Login failed. Please check your credentials.';
        this.isSubmitting = false;
      },
      complete: () => {
        this.isSubmitting = false;
      }
    });
  }
}