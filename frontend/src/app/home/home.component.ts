// src/app/home/home.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';
import { MessageService } from '../message.service';
import { UserService } from '../user.service';

interface Message {
  id: number;
  sender: string;
  encrypted_msg: string;
  decrypted?: string;
}

interface User {
  id: number;
  username: string;
  public_key: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  providers: [MessageService, UserService]
})
export class HomeComponent implements OnInit {
  messageForm: FormGroup;
  messages: Message[] = [];
  users: User[] = [];
  currentUser: string = '';
  isLoading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';

  constructor(
    private fb: FormBuilder,
    private messageService: MessageService,
    private userService: UserService,
    private router: Router
  ) {
    this.messageForm = this.fb.group({
      recipient: ['', Validators.required],
      message: ['', [Validators.required, Validators.minLength(1)]]
    });
  }

  ngOnInit(): void {
    // Check if user is logged in
    const username = localStorage.getItem('username');
    if (!username) {
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
        // Filter out current user
        this.users = users.filter(user => user.username !== this.currentUser);
      },
      error: (error) => {
        console.error('Error loading users', error);
        this.errorMessage = 'Failed to load users. Please try again later.';
      }
    });
  }

  loadMessages(): void {
    this.isLoading = true;
    this.messageService.getMessages().subscribe({
      next: (messages) => {
        this.messages = messages;
        this.isLoading = false;
        
        // TODO: In a real app, decrypt messages here using the private key
        // For demo purposes, we'll just display the encrypted messages
        this.messages.forEach(msg => {
          msg.decrypted = '(Encrypted message)'; // Placeholder for actual decryption
        });
      },
      error: (error) => {
        console.error('Error loading messages', error);
        this.errorMessage = 'Failed to load messages. Please try again later.';
        this.isLoading = false;
      }
    });
  }

  onSubmit(): void {
    if (this.messageForm.invalid) {
      return;
    }

    const { recipient, message } = this.messageForm.value;
    
    // For demo purposes, we're not implementing actual encryption yet
    // In a real app, you would:
    // 1. Generate an AES key
    // 2. Encrypt the message with the AES key
    // 3. Get recipient's public key
    // 4. Encrypt the AES key with recipient's public key
    // 5. Send both encrypted message and encrypted key

    this.isLoading = true;
    this.messageService.sendMessage({
      receiver: recipient,
      encrypted_msg: message, // This would be encrypted in a real app
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
    localStorage.removeItem('username');
    this.router.navigate(['/login']);
  }
}