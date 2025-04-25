from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os
import base64

def generate_rsa_key_pair():
    """Generate an RSA key pair and return it in PEM format"""
    private_key = rsa.generate_private_key(
        public_exponent=65537,  # Standard value for e
        key_size=2048,          # 2048 bits provides good security
    )
    
    public_key = private_key.public_key()
    
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    
    return {
        'private_key': private_pem.decode('utf-8'),
        'public_key': public_pem.decode('utf-8')
    }

def load_public_key(pem_key):
    """Load a public key from PEM format"""
    return serialization.load_pem_public_key(pem_key.encode('utf-8'))

def load_private_key(pem_key):
    """Load a private key from PEM format"""
    return serialization.load_pem_private_key(
        pem_key.encode('utf-8'),
        password=None
    )

def rsa_encrypt(public_key, data):
    """Encrypt data with RSA public key"""
    if isinstance(data, str):
        data = data.encode('utf-8')
    
    encrypted = public_key.encrypt(
        data,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    
    return base64.b64encode(encrypted).decode('utf-8')

def rsa_decrypt(private_key, encrypted_data):
    """Decrypt data with RSA private key"""
    if isinstance(encrypted_data, str):
        encrypted_data = base64.b64decode(encrypted_data)
    
    decrypted = private_key.decrypt(
        encrypted_data,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    
    return decrypted

def generate_aes_key():
    """Generate a random AES key"""
    return os.urandom(32)  # 256-bit key

def aes_encrypt(key, plaintext):
    """Encrypt data with AES-GCM"""
    if isinstance(plaintext, str):
        plaintext = plaintext.encode('utf-8')
    
    # Generate a random 96 bit nonce (12 bytes)
    nonce = os.urandom(12)
    
    # Create an AES-GCM cipher with the key
    aesgcm = AESGCM(key)
    
    # Encrypt the plaintext
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    
    # Return base64 encoded nonce and ciphertext
    return {
        'encrypted': base64.b64encode(ciphertext).decode('utf-8'),
        'nonce': base64.b64encode(nonce).decode('utf-8')
    }

def aes_decrypt(key, encrypted_data, nonce):
    """Decrypt data with AES-GCM"""
    if isinstance(encrypted_data, str):
        encrypted_data = base64.b64decode(encrypted_data)
    
    if isinstance(nonce, str):
        nonce = base64.b64decode(nonce)
    
    # Create an AES-GCM cipher with the key
    aesgcm = AESGCM(key)
    
    # Decrypt the ciphertext
    plaintext = aesgcm.decrypt(nonce, encrypted_data, None)
    
    return plaintext.decode('utf-8')

def encrypt_message(recipient_public_key_pem, message):
    """
    Full encryption workflow:
    1. Generate a random AES key
    2. Encrypt the message with AES
    3. Encrypt the AES key with the recipient's RSA public key
    4. Return everything needed for decryption
    """
    aes_key = generate_aes_key()
    
    encrypted_message = aes_encrypt(aes_key, message)

    public_key = load_public_key(recipient_public_key_pem)
 
    encrypted_key = rsa_encrypt(public_key, aes_key)

    return {
        'encrypted_message': encrypted_message['encrypted'],
        'encrypted_key': encrypted_key,
        'nonce': encrypted_message['nonce']
    }

def decrypt_message(private_key_pem, encrypted_message, encrypted_key, nonce):
    """
    Full decryption workflow:
    1. Decrypt the AES key with the recipient's RSA private key
    2. Decrypt the message with the AES key
    3. Return the original message
    """
    private_key = load_private_key(private_key_pem)
    
    aes_key = rsa_decrypt(private_key, encrypted_key)
    
    message = aes_decrypt(aes_key, encrypted_message, nonce)
    
    return message