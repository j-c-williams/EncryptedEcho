import sqlite3

conn = sqlite3.connect('encrypted_echo.db')
cursor = conn.cursor()

cursor.execute("SELECT * FROM users")
rows = cursor.fetchall()
for row in rows:
    print(row)

cursor.execute("SELECT * FROM messages")
rows = cursor.fetchall()
for row in rows:
    print(row)

conn.close()