"""
LinkedIn Pilot Server Diagnostic Tool
Tests the deployed application on the remote server
"""

import subprocess
import sys

SERVER = "root@138.197.35.30"
PASSWORD = "Hhwj65377068Hhwj"

def print_header(title):
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)

def run_ssh_command(command, description):
    """Run a command on the remote server via SSH"""
    print_header(description)

    # Try using plink (PuTTY) if available on Windows
    ssh_commands = [
        # Try plink first (Windows)
        f'plink -batch -pw "{PASSWORD}" {SERVER} "{command}"',
        # Try ssh with password (if sshpass is available)
        f'sshpass -p "{PASSWORD}" ssh -o StrictHostKeyChecking=no {SERVER} "{command}"',
    ]

    for ssh_cmd in ssh_commands:
        try:
            result = subprocess.run(
                ssh_cmd,
                shell=True,
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode == 0 or result.stdout or result.stderr:
                print(result.stdout)
                if result.stderr:
                    print("Errors:", result.stderr)
                return True

        except FileNotFoundError:
            continue
        except Exception as e:
            print(f"Error: {e}")
            continue

    print("Unable to connect via SSH. Please ensure plink or sshpass is installed.")
    return False

def main():
    print("="*60)
    print("LinkedIn Pilot Server Diagnostics")
    print(f"Server: {SERVER}")
    print("="*60)

    print("\nNote: This script requires either 'plink' (PuTTY) or 'sshpass' to be installed.")
    print("On Windows, you can install PuTTY from: https://www.putty.org/")

    # Test 1: PM2 Process Status
    run_ssh_command("pm2 list", "PM2 Process Status")

    # Test 2: Backend Status
    run_ssh_command("pm2 describe linkedin-pilot-backend", "Backend Service Details")

    # Test 3: Check if backend is listening
    run_ssh_command("netstat -tlnp | grep 5000", "Backend Port Status (5000)")

    # Test 4: Nginx Status
    run_ssh_command("systemctl status nginx --no-pager | head -20", "Nginx Service Status")

    # Test 5: Nginx Configuration Test
    run_ssh_command("nginx -t", "Nginx Configuration Test")

    # Test 6: Check Frontend Deployment
    run_ssh_command("ls -lah /var/www/linkedin-pilot/frontend/build/ | head -15", "Frontend Build Files")

    # Test 7: Check if index.html exists
    run_ssh_command("test -f /var/www/linkedin-pilot/frontend/build/index.html && echo 'index.html EXISTS' || echo 'index.html MISSING'", "Frontend index.html Check")

    # Test 8: Check Backend Directory
    run_ssh_command("ls -lah /var/www/linkedin-pilot/backend/ | head -15", "Backend Files")

    # Test 9: Check Nginx Site Configuration
    run_ssh_command("cat /etc/nginx/sites-enabled/linkedin-pilot 2>/dev/null || cat /etc/nginx/sites-enabled/default | head -50", "Nginx Site Configuration")

    # Test 10: Check Backend Logs
    run_ssh_command("pm2 logs linkedin-pilot-backend --lines 30 --nostream 2>&1", "Recent Backend Logs")

    # Test 11: Check Server Resources
    run_ssh_command("df -h | grep -E '(Filesystem|/dev/vda|/dev/sda)'", "Disk Space")
    run_ssh_command("free -h", "Memory Usage")

    # Test 12: Check if MongoDB is running
    run_ssh_command("systemctl status mongodb --no-pager | head -10 || systemctl status mongod --no-pager | head -10", "MongoDB Status")

    print_header("Diagnostic Summary")
    print("""
If you see:
- PM2 showing 'online' status: Backend is running ✓
- Nginx 'active (running)': Web server is running ✓
- Frontend build files exist: Frontend is deployed ✓
- Backend listening on port 5000: API is accessible ✓

Common issues:
1. If PM2 shows 'errored' or 'stopped': Backend needs restart
2. If Nginx returns 404: Check root path configuration
3. If frontend build is empty: Need to deploy frontend
4. If backend not on port 5000: Check environment variables
    """)

if __name__ == "__main__":
    main()
