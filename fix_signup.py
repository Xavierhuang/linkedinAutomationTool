"""
Deploy signup CORS fix to production server
"""

import subprocess
import time
import requests
import sys

SERVER = "root@138.197.35.30"
PASSWORD = "Hhwj65377068Hhwj"

def print_header(title):
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)

def run_command(cmd, description):
    """Run a local command"""
    print(f"\n{description}...")
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        if result.stdout:
            print(result.stdout)
        if result.stderr and "Warning" not in result.stderr:
            print(f"Errors: {result.stderr}")
        return result.returncode == 0
    except Exception as e:
        print(f"Error: {e}")
        return False

def main():
    print_header("LinkedIn Pilot - Signup CORS Fix Deployment")

    print("""
Issue Found:
- Backend CORS only allowed localhost origins
- Production domain https://mandi.media was blocked
- This caused all signup requests to fail with CORS errors

Fix Applied:
- Added "https://mandi.media" to allowed origins in server.py
- This will allow the frontend to communicate with the backend
    """)

    input("\nPress Enter to deploy the fix to production...")

    # Step 1: Upload fixed server.py
    print_header("Step 1: Upload Fixed server.py")

    cmd = f'scp backend/server.py {SERVER}:/var/www/linkedin-pilot/backend/'
    if not run_command(cmd, "Uploading server.py"):
        print("\n⚠ Could not upload via SCP.")
        print("Please manually upload backend/server.py to the server:")
        print(f"  scp backend/server.py {SERVER}:/var/www/linkedin-pilot/backend/")
        print("\nThen SSH into the server and run:")
        print("  cd /var/www/linkedin-pilot/backend")
        print("  pm2 restart linkedin-pilot-backend")
        return

    # Step 2: Restart backend
    print_header("Step 2: Restart Backend Service")

    cmd = f'ssh {SERVER} "cd /var/www/linkedin-pilot/backend && pm2 restart linkedin-pilot-backend"'
    if not run_command(cmd, "Restarting backend"):
        print("\n⚠ Could not restart via SSH.")
        print("Please manually restart the backend:")
        print(f"  ssh {SERVER}")
        print("  pm2 restart linkedin-pilot-backend")
        return

    # Wait for service to restart
    print("\nWaiting 5 seconds for service to restart...")
    time.sleep(5)

    # Step 3: Test the fix
    print_header("Step 3: Testing CORS Fix")

    try:
        # Test CORS preflight
        print("\nTesting CORS preflight for https://mandi.media...")
        response = requests.options(
            "https://mandi.media/api/auth/signup",
            headers={
                "Origin": "https://mandi.media",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type"
            },
            timeout=10
        )

        print(f"Status Code: {response.status_code}")

        # Check for CORS headers
        origin_header = response.headers.get('access-control-allow-origin')
        methods_header = response.headers.get('access-control-allow-methods')

        print(f"\nCORS Headers:")
        print(f"  Access-Control-Allow-Origin: {origin_header or 'NOT SET'}")
        print(f"  Access-Control-Allow-Methods: {methods_header or 'NOT SET'}")

        if origin_header and ('https://mandi.media' in origin_header or origin_header == '*'):
            print("\n✓ SUCCESS! CORS is now configured correctly!")
            print("\nYour friend should now be able to sign up at: https://mandi.media")
        else:
            print("\n✗ CORS still not working correctly")
            print("\nResponse body:", response.text[:200])

    except Exception as e:
        print(f"Error testing: {e}")

    print_header("Deployment Complete")
    print("""
Next Steps:
1. Ask your friend to try signing up again at https://mandi.media
2. If it still fails, have them:
   - Clear browser cache (Ctrl+Shift+Delete)
   - Try in incognito/private mode
   - Check browser console for errors (F12)

If issues persist, check:
- Backend logs: ssh {SERVER} "pm2 logs linkedin-pilot-backend"
- Make sure MongoDB is running
- Check .env file has correct configuration
    """.format(SERVER=SERVER))

if __name__ == "__main__":
    main()
