import sqlite3

conn = sqlite3.connect('encrypted_echo.db')
c = conn.cursor()

# Create a table for storing user data
c.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
          public_key TEXT
      )
  ''')

# Create a table for storing messages
c.execute('''
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER,
    receiver_id INTEGER,
    encrypted_message TEXT,
    FOREIGN KEY(sender_id) REFERENCES users(id),
    FOREIGN KEY(receiver_id) REFERENCES users(id)
)
''')

conn.commit()
conn.close()
print("Database setup complete. Tables created if they didn't exist.")