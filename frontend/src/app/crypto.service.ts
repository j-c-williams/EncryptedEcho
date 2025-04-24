// src/app/crypto.service.ts
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

declare const window: any;

@Injectable({
  providedIn: 'root'
})
export class CryptoService {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  constructor() {
    // Import the crypto libraries only in browser context
    if (this.isBrowser) {
      this.loadCryptoLibraries();
    }
  }

  private loadCryptoLibraries(): void {
    // We'll use the Web Crypto API for this implementation
    if (!window.crypto || !window.crypto.subtle) {
      console.error('Web Crypto API is not supported in this browser');
    }
  }

  /**
   * Generate a new RSA key pair
   * @returns Promise with public and private keys in JWK format
   */
  async generateKeyPair(): Promise<{ publicKey: string, privateKey: string }> {
    if (!this.isBrowser) {
      return { publicKey: '', privateKey: '' };
    }

    try {
      // Generate a new RSA key pair
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true, // extractable
        ['encrypt', 'decrypt'] // key usage
      );

      // Export the public key to JWK format
      const publicKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);

      // Export the private key to JWK format
      const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);

      // Return both keys as strings
      return {
        publicKey: JSON.stringify(publicKeyJwk),
        privateKey: JSON.stringify(privateKeyJwk)
      };
    } catch (error) {
      console.error('Error generating key pair:', error);
      throw error;
    }
  }

  /**
   * Import a public key from JWK format
   * @param publicKeyJwk - Public key in JWK format as string
   * @returns CryptoKey
   */
  async importPublicKey(publicKeyJwk: string): Promise<CryptoKey> {
    if (!this.isBrowser) {
      throw new Error('Not in browser context');
    }

    try {
      const jwk = JSON.parse(publicKeyJwk);
      return await window.crypto.subtle.importKey(
        'jwk',
        jwk,
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256',
        },
        true,
        ['encrypt']
      );
    } catch (error) {
      console.error('Error importing public key:', error);
      throw error;
    }
  }

  /**
   * Import a private key from JWK format
   * @param privateKeyJwk - Private key in JWK format as string
   * @returns CryptoKey
   */
  async importPrivateKey(privateKeyJwk: string): Promise<CryptoKey> {
    if (!this.isBrowser) {
      throw new Error('Not in browser context');
    }

    try {
      const jwk = JSON.parse(privateKeyJwk);
      return await window.crypto.subtle.importKey(
        'jwk',
        jwk,
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256',
        },
        true,
        ['decrypt']
      );
    } catch (error) {
      console.error('Error importing private key:', error);
      throw error;
    }
  }

  /**
   * Generate a random AES key
   * @returns Promise with AES key
   */
  async generateAesKey(): Promise<CryptoKey> {
    if (!this.isBrowser) {
      throw new Error('Not in browser context');
    }

    try {
      return await window.crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256
        },
        true,
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      console.error('Error generating AES key:', error);
      throw error;
    }
  }

  /**
   * Export an AES key to raw format
   * @param key - AES key
   * @returns Promise with exported key as ArrayBuffer
   */
  async exportAesKey(key: CryptoKey): Promise<ArrayBuffer> {
    if (!this.isBrowser) {
      throw new Error('Not in browser context');
    }

    try {
      return await window.crypto.subtle.exportKey('raw', key);
    } catch (error) {
      console.error('Error exporting AES key:', error);
      throw error;
    }
  }

  /**
   * Import an AES key from raw format
   * @param keyData - Key data as ArrayBuffer
   * @returns Promise with imported AES key
   */
  async importAesKey(keyData: ArrayBuffer): Promise<CryptoKey> {
    if (!this.isBrowser) {
      throw new Error('Not in browser context');
    }

    try {
      return await window.crypto.subtle.importKey(
        'raw',
        keyData,
        {
          name: 'AES-GCM',
          length: 256
        },
        true,
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      console.error('Error importing AES key:', error);
      throw error;
    }
  }

  /**
   * Encrypt a message with AES-GCM
   * @param message - Message to encrypt
   * @param key - AES key
   * @returns Promise with encrypted message and IV
   */
  async encryptMessage(message: string, key: CryptoKey): Promise<{ ciphertext: ArrayBuffer, iv: Uint8Array }> {
    if (!this.isBrowser) {
      throw new Error('Not in browser context');
    }

    try {
      // Generate a random IV
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      // Convert message to ArrayBuffer
      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      
      // Encrypt the message
      const ciphertext = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv
        },
        key,
        data
      );
      
      return { ciphertext, iv };
    } catch (error) {
      console.error('Error encrypting message:', error);
      throw error;
    }
  }

  /**
   * Decrypt a message with AES-GCM
   * @param ciphertext - Encrypted message
   * @param key - AES key
   * @param iv - Initialization vector
   * @returns Promise with decrypted message
   */
  async decryptMessage(ciphertext: ArrayBuffer, key: CryptoKey, iv: Uint8Array): Promise<string> {
    if (!this.isBrowser) {
      throw new Error('Not in browser context');
    }

    try {
      // Decrypt the message
      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv
        },
        key,
        ciphertext
      );
      
      // Convert decrypted ArrayBuffer to string
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('Error decrypting message:', error);
      throw error;
    }
  }

  /**
   * Encrypt an AES key with RSA-OAEP
   * @param aesKey - AES key to encrypt
   * @param publicKey - RSA public key
   * @returns Promise with encrypted AES key
   */
  async encryptAesKey(aesKey: ArrayBuffer, publicKey: CryptoKey): Promise<ArrayBuffer> {
    if (!this.isBrowser) {
      throw new Error('Not in browser context');
    }

    try {
      return await window.crypto.subtle.encrypt(
        {
          name: 'RSA-OAEP'
        },
        publicKey,
        aesKey
      );
    } catch (error) {
      console.error('Error encrypting AES key:', error);
      throw error;
    }
  }

  /**
   * Decrypt an AES key with RSA-OAEP
   * @param encryptedKey - Encrypted AES key
   * @param privateKey - RSA private key
   * @returns Promise with decrypted AES key
   */
  async decryptAesKey(encryptedKey: ArrayBuffer, privateKey: CryptoKey): Promise<ArrayBuffer> {
    if (!this.isBrowser) {
      throw new Error('Not in browser context');
    }

    try {
      return await window.crypto.subtle.decrypt(
        {
          name: 'RSA-OAEP'
        },
        privateKey,
        encryptedKey
      );
    } catch (error) {
      console.error('Error decrypting AES key:', error);
      throw error;
    }
  }

  /**
   * Convert ArrayBuffer to Base64 string
   * @param buffer - ArrayBuffer to convert
   * @returns Base64 string
   */
  arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Convert Base64 string to ArrayBuffer
   * @param base64 - Base64 string to convert
   * @returns ArrayBuffer
   */
  base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}