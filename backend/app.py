from flask import Flask, request, jsonify, g
from flask_cors import CORS
import sqlite3
import bcrypt
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

DATABASE = 'encrypted_echo.db'

# --- Database connection helper ---
def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_connection(exception):
    db = g.pop('db', None)
    if db is not None:
        db.close()

# --- Register route ---
@app.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "Invalid JSON or missing Content-Type header"}), 400
            
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({"error": "Username and password are required."}), 400

        # Hash the password
        hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

        # Store in database
        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)", 
                (username, hashed_pw)
            )
            db.commit()
            return jsonify({"message": "User registered successfully!"}), 201
        except sqlite3.IntegrityError:
            return jsonify({"error": "Username already exists"}), 400
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

# --- Login route ---
@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "Invalid JSON or missing Content-Type header"}), 400
            
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({"error": "Username and password are required."}), 400

        # Check credentials
        db = get_db()
        cursor = db.cursor()
        user = cursor.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        
        if user and bcrypt.checkpw(password.encode('utf-8'), user['password_hash']):
            return jsonify({
                "message": "Login successful!",
                "user_id": user['id']
            }), 200
        else:
            return jsonify({"error": "Invalid credentials"}), 401
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

# --- Get Users route ---
@app.route('/users', methods=['GET'])
def get_users():
    try:
        db = get_db()
        cursor = db.cursor()
        users = cursor.execute("SELECT id, username FROM users").fetchall()
        
        # Convert to list of dictionaries
        users_list = []
        for user in users:
            users_list.append({
                "id": user['id'],
                "username": user['username']
            })
        
        return jsonify(users_list), 200
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

# --- Send Message route ---
@app.route('/send', methods=['POST'])
def send_message():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "Invalid JSON or missing Content-Type header"}), 400
            
        sender_username = data.get('sender')
        receiver_username = data.get('receiver')
        encrypted_msg = data.get('encrypted_msg')
        
        if not sender_username or not receiver_username or not encrypted_msg:
            return jsonify({"error": "Sender, receiver, and encrypted message are required."}), 400

        # Get user IDs
        db = get_db()
        cursor = db.cursor()
        
        sender = cursor.execute("SELECT id FROM users WHERE username = ?", (sender_username,)).fetchone()
        if not sender:
            return jsonify({"error": "Sender does not exist"}), 400
        
        receiver = cursor.execute("SELECT id FROM users WHERE username = ?", (receiver_username,)).fetchone()
        if not receiver:
            return jsonify({"error": "Receiver does not exist"}), 400
        
        # Store the message
        cursor.execute(
            "INSERT INTO messages (sender_id, receiver_id, encrypted_message) VALUES (?, ?, ?)", 
            (sender['id'], receiver['id'], encrypted_msg)
        )
        db.commit()
        
        return jsonify({"message": "Message sent successfully!"}), 201
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

# --- Get Messages route ---
@app.route('/messages', methods=['GET'])
def get_messages():
    try:
        username = request.args.get('username')
        
        if not username:
            return jsonify({"error": "Username is required."}), 400
        
        db = get_db()
        cursor = db.cursor()
        
        # Get user id
        user = cursor.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if not user:
            return jsonify({"error": "User does not exist"}), 400
        
        # Get messages where the user is the receiver
        # Join with users table to get the sender's username
        messages = cursor.execute('''
            SELECT m.id, u.username as sender, m.encrypted_message
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.receiver_id = ?
            ORDER BY m.id DESC
        ''', (user['id'],)).fetchall()
        
        # Convert to list of dictionaries
        messages_list = []
        for message in messages:
            messages_list.append({
                "id": message['id'],
                "sender": message['sender'],
                "encrypted_msg": message['encrypted_message']
            })
        
        return jsonify(messages_list), 200
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

# --- Test route (optional) ---
@app.route('/')
def index():
    return "Encrypted Echo backend is running!"

# --- Run the app ---
if __name__ == '__main__':
    # Run the app
    app.run(debug=True, host='0.0.0.0', port=5000)