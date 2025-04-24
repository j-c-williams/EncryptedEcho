// src/app/message.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface MessageResponse {
  id: number;
  sender: string;
  encrypted_msg: string;
}

export interface MessageRequest {
  receiver: string;
  encrypted_msg: string;
}

@Injectable({
  providedIn: 'root'
})
export class MessageService {
  private apiUrl = 'http://localhost:5000';

  constructor(private http: HttpClient) { }

  getMessages(): Observable<MessageResponse[]> {
    // Get the current user from localStorage
    const username = localStorage.getItem('username');
    
    // We'll use the username as a query parameter
    return this.http.get<MessageResponse[]>(`${this.apiUrl}/messages?username=${username}`);
  }

  sendMessage(message: MessageRequest): Observable<any> {
    // Add the sender from localStorage
    const sender = localStorage.getItem('username');
    
    return this.http.post(`${this.apiUrl}/send`, {
      sender,
      ...message
    });
  }
}