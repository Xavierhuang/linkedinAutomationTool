import requests
import json
import sys
from datetime import datetime

# Fix encoding for Windows console
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

SERVER_URL = "https://mandi.media"

def print_header(text):
    print(f"\n{'='*60}")
    print(f"  {text}")
    print('='*60)

def test_frontend():
    print_header("Testing Frontend")
    try:
        response = requests.get(SERVER_URL, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Server: {response.headers.get('Server', 'Unknown')}")
        print(f"Content-Type: {response.headers.get('Content-Type', 'Unknown')}")
        print(f"Content Length: {len(response.content)} bytes")
        if response.status_code == 200:
            print("✓ Frontend is accessible")
            return True
        else:
            print(f"✗ Frontend returned {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Error accessing frontend: {e}")
        return False

def test_api_health():
    print_header("Testing API Health")
    endpoints = [
        "/api/health",
        "/api/",
        "/health"
    ]

    for endpoint in endpoints:
        try:
            url = f"{SERVER_URL}{endpoint}"
            print(f"\nTrying: {url}")
            response = requests.get(url, timeout=10)
            print(f"Status Code: {response.status_code}")
            if response.status_code == 200:
                try:
                    print(f"Response: {response.json()}")
                except:
                    print(f"Response: {response.text[:200]}")
                print(f"✓ Health endpoint working at {endpoint}")
                return True
        except Exception as e:
            print(f"✗ Error: {e}")

    print("\n✗ No working health endpoint found")
    return False

def test_api_endpoints():
    print_header("Testing API Endpoints")

    endpoints = [
        ("/api/campaigns", "GET"),
        ("/api/posts", "GET"),
        ("/api/drafts", "GET"),
        ("/api/settings", "GET"),
    ]

    results = []
    for endpoint, method in endpoints:
        try:
            url = f"{SERVER_URL}{endpoint}"
            print(f"\n{method} {url}")
            response = requests.request(method, url, timeout=10)
            print(f"Status Code: {response.status_code}")

            if response.status_code in [200, 401, 403]:
                print(f"✓ Endpoint reachable (auth may be required)")
                results.append(True)
            else:
                print(f"✗ Unexpected status code")
                results.append(False)
        except Exception as e:
            print(f"✗ Error: {e}")
            results.append(False)

    return any(results)

def test_nginx_config():
    print_header("Testing Nginx Configuration")
    try:
        response = requests.get(f"{SERVER_URL}/static/js/main.js", timeout=10)
        print(f"Static files test: {response.status_code}")

        if response.status_code in [200, 404]:
            print("✓ Nginx is serving requests")
            return True
        else:
            print(f"✗ Unexpected response: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def test_cors():
    print_header("Testing CORS Configuration")
    try:
        headers = {'Origin': 'http://localhost:3000'}
        response = requests.options(f"{SERVER_URL}/api/health", headers=headers, timeout=10)
        print(f"OPTIONS request status: {response.status_code}")
        print(f"Access-Control-Allow-Origin: {response.headers.get('Access-Control-Allow-Origin', 'Not set')}")

        if 'Access-Control-Allow-Origin' in response.headers:
            print("✓ CORS headers present")
            return True
        else:
            print("⚠ CORS headers may not be configured")
            return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def main():
    print("="*60)
    print(f"LinkedIn Pilot Deployment Test")
    print(f"Server: {SERVER_URL}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)

    results = {
        "Frontend": test_frontend(),
        "API Health": test_api_health(),
        "API Endpoints": test_api_endpoints(),
        "Nginx": test_nginx_config(),
        "CORS": test_cors()
    }

    print_header("Test Summary")
    for test_name, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{test_name:20} {status}")

    passed_count = sum(results.values())
    total_count = len(results)
    print(f"\nTotal: {passed_count}/{total_count} tests passed")

    if passed_count == 0:
        print("\n⚠ WARNING: All tests failed. The application may not be running.")
        print("Possible issues:")
        print("1. Backend service (PM2) may not be running")
        print("2. Nginx may not be configured correctly")
        print("3. Frontend build may not be deployed")
        print("4. Server firewall may be blocking connections")

if __name__ == "__main__":
    main()
