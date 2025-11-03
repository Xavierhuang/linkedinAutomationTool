import os
from pymongo import MongoClient
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv('backend/.env')

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'linkedin_pilot')

print(f"Connecting to: {mongo_url}")
print(f"Database: {db_name}\n")

client = MongoClient(mongo_url)
db = client[db_name]

email = "evanslockwood69@gmail.com"
new_password = input("Enter NEW password: ")
confirm_password = input("Confirm password: ")

if new_password != confirm_password:
    print("❌ Passwords don't match!")
    exit(1)

if len(new_password) < 6:
    print("❌ Password must be at least 6 characters!")
    exit(1)

# Hash the new password
hashed_password = pwd_context.hash(new_password)

# Update in database
result = db.users.update_one(
    {"email": email},
    {"$set": {"hashed_password": hashed_password}}
)

if result.modified_count > 0:
    print(f"\n✅ Password reset successful for {email}")
    print("You can now login with your new password!")
else:
    print(f"\n❌ Failed to update password. User might not exist.")

client.close()

