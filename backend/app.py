from flask import Flask, request, jsonify, g
import sqlite3
import bcrypt
import os

app = Flask(__name__)
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
            cursor.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", 
                          (username, hashed_pw))
            db.commit()
            return jsonify({"message": "User registered successfully!"}), 201
        except sqlite3.IntegrityError:
            return jsonify({"error": "Username already exists"}), 400
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

# --- Login route (suggested addition) ---
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
            return jsonify({"message": "Login successful!"}), 200
        else:
            return jsonify({"error": "Invalid credentials"}), 401
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

# --- Test route (optional) ---
@app.route('/')
def index():
    return "Encrypted Echo backend is running!"

# --- Run the app ---
if __name__ == '__main__':
    # Initialize the database before running the app
    # You might need to specify host='0.0.0.0' to make it accessible externally
    app.run(debug=True, host='0.0.0.0', port=5000)