import os
import requests
import json
from dotenv import load_dotenv

load_dotenv('backend/.env')

print("Testing login endpoint...")
print(f"Backend URL: http://localhost:8000")
print(f"Database: {os.getenv('DB_NAME')}\n")

# Test credentials - you'll need to enter your actual password
email = "evanslockwood69@gmail.com"
password = input("Enter your password: ")

try:
    response = requests.post(
        "http://localhost:8000/api/auth/login",
        json={"email": email, "password": password},
        headers={"Content-Type": "application/json"}
    )
    
    print(f"\nStatus Code: {response.status_code}")
    
    if response.status_code == 200:
        print("✅ LOGIN SUCCESSFUL!")
        data = response.json()
        print(f"User: {data.get('user', {}).get('full_name')}")
        print(f"Token: {data.get('access_token')[:50]}...")
    elif response.status_code == 401:
        print("❌ LOGIN FAILED: Invalid email or password")
        print(f"Response: {response.json()}")
        print("\nPossible issues:")
        print("1. Wrong password")
        print("2. Backend not restarted properly")
        print("3. Backend still using wrong database")
    else:
        print(f"❌ Unexpected error: {response.status_code}")
        print(f"Response: {response.text}")
        
except requests.exceptions.ConnectionError:
    print("❌ Cannot connect to backend!")
    print("Make sure backend is running on http://localhost:8000")
except Exception as e:
    print(f"❌ Error: {e}")

