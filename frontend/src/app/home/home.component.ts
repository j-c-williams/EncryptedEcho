// src/app/home/home.component.ts
import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';
import { MessageService, DecryptedMessage } from '../message.service';
import { UserService } from '../user.service';
import { AuthService } from '../auth/auth.service';
import { CryptoService } from '../crypto.service';

interface User {
  id: number;
  username: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  providers: [MessageService, UserService, CryptoService, AuthService]
})
export class HomeComponent implements OnInit {
  messageForm: FormGroup;
  messages: DecryptedMessage[] = [];
  users: User[] = [];
  currentUser: string = '';
  isLoading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';
  
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  constructor(
    private fb: FormBuilder,
    private messageService: MessageService,
    private userService: UserService,
    private authService: AuthService,
    private router: Router
  ) {
    this.messageForm = this.fb.group({
      recipient: ['', Validators.required],
      message: ['', [Validators.required, Validators.minLength(1)]]
    });
  }

  ngOnInit(): void {
    // Skip localStorage checks if we're not in the browser
    if (!this.isBrowser) {
      return;
    }
    
    // Check if user is logged in and has a private key
    const username = localStorage.getItem('username');
    if (!username || !this.authService.hasPrivateKey()) {
      this.router.navigate(['/login']);
      return;
    }

    this.currentUser = username;
    this.loadUsers();
    this.loadMessages();
  }

  loadUsers(): void {
    this.userService.getUsers().subscribe({
      next: (users) => {
        // Filter out current user if we're in the browser
        if (this.isBrowser) {
          this.users = users.filter(user => user.username !== this.currentUser);
        } else {
          this.users = users;
        }
      },
      error: (error) => {
        console.error('Error loading users', error);
        this.errorMessage = 'Failed to load users. Please try again later.';
      }
    });
  }

  loadMessages(): void {
    if (!this.isBrowser) {
      return; // Skip on the server side
    }
    
    this.isLoading = true;
    this.messageService.getMessages().subscribe({
      next: (messages) => {
        this.messages = messages;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading messages', error);
        this.errorMessage = 'Failed to load messages. Please try again later.';
        this.isLoading = false;
      }
    });
  }

  onSubmit(): void {
    if (this.messageForm.invalid || !this.isBrowser) {
      return;
    }

    const { recipient, message } = this.messageForm.value;
    
    this.isLoading = true;
    this.errorMessage = '';
    
    this.messageService.sendMessage({
      receiver: recipient,
      message: message
    }).subscribe({
      next: (response) => {
        console.log('Message sent successfully', response);
        this.successMessage = 'Message sent successfully!';
        this.messageForm.reset();
        this.loadMessages(); // Reload messages
        this.isLoading = false;

        // Clear success message after 3 seconds
        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      },
      error: (error) => {
        console.error('Error sending message', error);
        this.errorMessage = error.error?.error || 'Failed to send message. Please try again later.';
        this.isLoading = false;
      }
    });
  }

  logout(): void {
    if (this.isBrowser) {
      this.authService.logout();
      this.router.navigate(['/login']);
    }
  }
}