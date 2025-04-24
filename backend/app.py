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

# --- Helper to describe the database structure ---
def describe_table(table_name):
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    columns = cursor.execute(f"PRAGMA table_info({table_name})").fetchall()
    conn.close()
    return [col[1] for col in columns]  # col[1] is name

# --- Register route ---
@app.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "Invalid JSON or missing Content-Type header"}), 400
            
        username = data.get('username')
        password = data.get('password')
        public_key = data.get('public_key')

        if not username or not password:
            return jsonify({"error": "Username and password are required."}), 400

        # Hash the password
        hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

        # Store in database
        db = get_db()
        cursor = db.cursor()
        
        try:
            # Check if the users table has a public_key column
            columns = describe_table('users')
            
            if 'public_key' in columns:
                cursor.execute(
                    "INSERT INTO users (username, password_hash, public_key) VALUES (?, ?, ?)", 
                    (username, hashed_pw, public_key)
                )
            else:
                cursor.execute(
                    "INSERT INTO users (username, password_hash) VALUES (?, ?)", 
                    (username, hashed_pw)
                )
                
                # If public_key column doesn't exist, try to add it
                try:
                    cursor.execute("ALTER TABLE users ADD COLUMN public_key TEXT")
                    # Update the user we just inserted
                    cursor.execute(
                        "UPDATE users SET public_key = ? WHERE username = ?",
                        (public_key, username)
                    )
                except sqlite3.OperationalError:
                    # Ignore error if column already exists or can't be added
                    pass
                    
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

# --- Get User Public Key route ---
@app.route('/user_public_key', methods=['GET'])
def get_user_public_key():
    try:
        username = request.args.get('username')
        
        if not username:
            return jsonify({"error": "Username is required."}), 400
        
        db = get_db()
        cursor = db.cursor()
        
        # Check if the users table has a public_key column
        columns = describe_table('users')
        
        if 'public_key' not in columns:
            return jsonify({"error": "Public key not available."}), 404
        
        # Get the user's public key
        user = cursor.execute("SELECT public_key FROM users WHERE username = ?", (username,)).fetchone()
        
        if not user or not user['public_key']:
            return jsonify({"error": "User not found or public key not available."}), 404
        
        return jsonify({
            "username": username,
            "public_key": user['public_key']
        }), 200
        
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
        print(f"Received message data: {data}")
        
        if not data:
            return jsonify({"error": "Invalid JSON or missing Content-Type header"}), 400
            
        sender_username = data.get('sender')
        receiver_username = data.get('receiver')
        encrypted_msg = data.get('encrypted_msg')
        encrypted_key = data.get('encrypted_key')
        iv = data.get('iv')
        
        if not sender_username or not receiver_username or not encrypted_msg:
            return jsonify({"error": "Sender, receiver, and encrypted message are required."}), 400

        # Get user IDs
        db = get_db()
        cursor = db.cursor()
        
        # Get sender ID
        sender = cursor.execute("SELECT id FROM users WHERE username = ?", (sender_username,)).fetchone()
        if not sender:
            return jsonify({"error": "Sender does not exist"}), 400
        sender_id = sender['id']
        
        # Get receiver ID
        receiver = cursor.execute("SELECT id FROM users WHERE username = ?", (receiver_username,)).fetchone()
        if not receiver:
            return jsonify({"error": "Receiver does not exist"}), 400
        receiver_id = receiver['id']
        
        print(f"Sender ID: {sender_id}, Receiver ID: {receiver_id}")
        
        # Check if the messages table has the necessary columns
        columns = describe_table('messages')
        
        # Ensure the messages table has columns for encryption data
        if 'encrypted_key' not in columns:
            try:
                cursor.execute("ALTER TABLE messages ADD COLUMN encrypted_key TEXT")
            except sqlite3.OperationalError:
                # Ignore error if column already exists
                pass
                
        if 'iv' not in columns:
            try:
                cursor.execute("ALTER TABLE messages ADD COLUMN iv TEXT")
            except sqlite3.OperationalError:
                # Ignore error if column already exists
                pass
        
        # Store the message
        try:
            if 'encrypted_key' in columns and 'iv' in columns:
                cursor.execute(
                    "INSERT INTO messages (sender_id, receiver_id, encrypted_message, encrypted_key, iv) VALUES (?, ?, ?, ?, ?)", 
                    (sender_id, receiver_id, encrypted_msg, encrypted_key, iv)
                )
            else:
                cursor.execute(
                    "INSERT INTO messages (sender_id, receiver_id, encrypted_message) VALUES (?, ?, ?)", 
                    (sender_id, receiver_id, encrypted_msg)
                )
            db.commit()
            return jsonify({"message": "Message sent successfully!"}), 201
        except Exception as insert_error:
            print(f"Error inserting message: {insert_error}")
            
            # If there was an error, try creating the table
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER,
                receiver_id INTEGER,
                encrypted_message TEXT,
                encrypted_key TEXT,
                iv TEXT,
                FOREIGN KEY(sender_id) REFERENCES users(id),
                FOREIGN KEY(receiver_id) REFERENCES users(id)
            )
            ''')
            db.commit()
            
            # Try the insert again
            cursor.execute(
                "INSERT INTO messages (sender_id, receiver_id, encrypted_message, encrypted_key, iv) VALUES (?, ?, ?, ?, ?)", 
                (sender_id, receiver_id, encrypted_msg, encrypted_key, iv)
            )
            db.commit()
            return jsonify({"message": "Message sent successfully (after table creation)!"}), 201
                
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
        
        user_id = user['id']
        print(f"Getting messages for user ID: {user_id}")
        
        # Check message table columns
        columns = describe_table('messages')
        
        try:
            # Get all columns from messages table
            query = """
                SELECT m.id, u.username as sender, m.encrypted_message, 
            """
            
            # Add encrypted_key and iv columns if they exist
            params = []
            if 'encrypted_key' in columns:
                query += "m.encrypted_key, "
            else:
                query += "NULL as encrypted_key, "
                
            if 'iv' in columns:
                query += "m.iv "
            else:
                query += "NULL as iv "
                
            # Complete the query
            query += """
                FROM messages m
                JOIN users u ON m.sender_id = u.id
                WHERE m.receiver_id = ?
                ORDER BY m.id DESC
            """
            
            message_rows = cursor.execute(query, (user_id,)).fetchall()
            
            print(f"Found {len(message_rows)} messages")
            
            # Build the response
            messages_list = []
            for msg in message_rows:
                message_dict = {
                    "id": msg['id'],
                    "sender": msg['sender'],
                    "encrypted_msg": msg['encrypted_message']
                }
                
                # Add encryption data if available
                if 'encrypted_key' in columns and msg['encrypted_key']:
                    message_dict['encrypted_key'] = msg['encrypted_key']
                    
                if 'iv' in columns and msg['iv']:
                    message_dict['iv'] = msg['iv']
                
                messages_list.append(message_dict)
            
            return jsonify(messages_list), 200
            
        except Exception as specific_error:
            print(f"Error retrieving messages: {specific_error}")
            raise specific_error
            
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

# --- Debug route to check database structure ---
@app.route('/dbinfo', methods=['GET'])
def db_info():
    try:
        users_columns = describe_table('users')
        messages_columns = describe_table('messages')
        
        return jsonify({
            "users_table": users_columns,
            "messages_table": messages_columns
        }), 200
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