// src/app/message.service.ts
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, catchError, switchMap, map } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { CryptoService } from './crypto.service';
import { AuthService } from './auth/auth.service';

export interface MessageResponse {
  id: number;
  sender: string;
  encrypted_msg: string;
  encrypted_key?: string;
  iv?: string;
}

export interface MessageRequest {
  receiver: string;
  encrypted_msg: string;
  encrypted_key?: string;
  iv?: string;
}

export interface DecryptedMessage {
  id: number;
  sender: string;
  decrypted: string;
  encrypted_msg: string;
}

export interface UserPublicKey {
  username: string;
  public_key: string;
}

@Injectable({
  providedIn: 'root'
})
export class MessageService {
  private apiUrl = 'http://localhost:5000';
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  
  constructor(
    private http: HttpClient,
    private cryptoService: CryptoService,
    private authService: AuthService
  ) { }

  /**
   * Get the public key for a user
   * @param username - Username to get public key for
   * @returns Observable with the user's public key
   */
  getUserPublicKey(username: string): Observable<string> {
    return this.http.get<UserPublicKey>(`${this.apiUrl}/user_public_key?username=${username}`)
      .pipe(
        map(response => response.public_key),
        catchError(error => {
          console.error('Error getting public key:', error);
          throw error;
        })
      );
  }

  /**
   * Get messages for the current user and decrypt them
   * @returns Observable with decrypted messages
   */
  getMessages(): Observable<DecryptedMessage[]> {
    // Return empty array if not in browser
    if (!this.isBrowser) {
      return of([]);
    }
    
    // Get the current user from localStorage
    const username = localStorage.getItem('username');
    if (!username) {
      return of([]);
    }
    
    // Get the private key
    const privateKeyJwk = this.authService.getPrivateKey();
    if (!privateKeyJwk) {
      console.error('No private key found');
      return of([]);
    }
    
    // Get messages from the server
    return this.http.get<MessageResponse[]>(`${this.apiUrl}/messages?username=${username}`)
      .pipe(
        switchMap(async messages => {
          try {
            // Import the private key
            const privateKey = await this.cryptoService.importPrivateKey(privateKeyJwk);
            
            // Decrypt each message
            const decryptedMessages: DecryptedMessage[] = [];
            
            for (const message of messages) {
              try {
                // Skip messages without encryption data
                if (!message.encrypted_key || !message.iv) {
                  decryptedMessages.push({
                    id: message.id,
                    sender: message.sender,
                    decrypted: '(Unable to decrypt - missing encryption data)',
                    encrypted_msg: message.encrypted_msg
                  });
                  continue;
                }
                
                // Decode the encrypted key and IV
                const encryptedKey = this.cryptoService.base64ToArrayBuffer(message.encrypted_key);
                const iv = new Uint8Array(this.cryptoService.base64ToArrayBuffer(message.iv));
                
                // Decrypt the AES key
                const aesKeyData = await this.cryptoService.decryptAesKey(encryptedKey, privateKey);
                const aesKey = await this.cryptoService.importAesKey(aesKeyData);
                
                // Decrypt the message
                const encryptedMessage = this.cryptoService.base64ToArrayBuffer(message.encrypted_msg);
                const decryptedMessage = await this.cryptoService.decryptMessage(encryptedMessage, aesKey, iv);
                
                decryptedMessages.push({
                  id: message.id,
                  sender: message.sender,
                  decrypted: decryptedMessage,
                  encrypted_msg: message.encrypted_msg
                });
              } catch (error) {
                console.error('Error decrypting message:', error);
                decryptedMessages.push({
                  id: message.id,
                  sender: message.sender,
                  decrypted: '(Unable to decrypt message)',
                  encrypted_msg: message.encrypted_msg
                });
              }
            }
            
            return decryptedMessages;
          } catch (error) {
            console.error('Error processing messages:', error);
            return [];
          }
        }),
        catchError(error => {
          console.error('Error getting messages:', error);
          return of([]);
        })
      );
  }

  /**
   * Send an encrypted message
   * @param messageData - Message data with recipient and plain text
   * @returns Observable with the server response
   */
  sendMessage(messageData: { receiver: string, message: string }): Observable<any> {
    // Return empty response if not in browser
    if (!this.isBrowser) {
      return of({ message: 'Message sent successfully!' });
    }
    
    // Get the sender from localStorage
    const sender = localStorage.getItem('username');
    if (!sender) {
      return of({ error: 'Not logged in' });
    }
    
    // Get the recipient's public key
    return this.getUserPublicKey(messageData.receiver).pipe(
      switchMap(async publicKeyJwk => {
        try {
          // Import the recipient's public key
          const publicKey = await this.cryptoService.importPublicKey(publicKeyJwk);
          
          // Generate a new AES key for this message
          const aesKey = await this.cryptoService.generateAesKey();
          
          // Encrypt the message with the AES key
          const { ciphertext, iv } = await this.cryptoService.encryptMessage(messageData.message, aesKey);
          
          // Export the AES key
          const aesKeyData = await this.cryptoService.exportAesKey(aesKey);
          
          // Encrypt the AES key with the recipient's public key
          const encryptedKey = await this.cryptoService.encryptAesKey(aesKeyData, publicKey);
          
          // Convert binary data to base64 for transmission
          const encryptedMessage = this.cryptoService.arrayBufferToBase64(ciphertext);
          const encryptedKeyBase64 = this.cryptoService.arrayBufferToBase64(encryptedKey);
          const ivBase64 = this.cryptoService.arrayBufferToBase64(iv.buffer);
          
          // Create the message request
          const messageRequest: MessageRequest = {
            receiver: messageData.receiver,
            encrypted_msg: encryptedMessage,
            encrypted_key: encryptedKeyBase64,
            iv: ivBase64
          };
          
          // Send the encrypted message to the server
          return this.http.post(`${this.apiUrl}/send`, {
            sender,
            ...messageRequest
          }).toPromise();
        } catch (error) {
          console.error('Error encrypting message:', error);
          throw error;
        }
      }),
      catchError(error => {
        console.error('Error sending message:', error);
        throw error;
      })
    );
  }
}