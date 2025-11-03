"""
Comprehensive LinkedIn Pilot Live App Testing
Tests the deployed application at mandi.media
"""

import requests
import json
import sys
from datetime import datetime

# Fix encoding for Windows console
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "https://mandi.media"

def print_header(text):
    print(f"\n{'='*70}")
    print(f"  {text}")
    print('='*70)

def print_subheader(text):
    print(f"\n  {text}")
    print(f"  {'-' * len(text)}")

def test_frontend_loading():
    """Test if the frontend React app loads correctly"""
    print_header("Frontend Loading Test")

    try:
        response = requests.get(BASE_URL, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Content-Type: {response.headers.get('Content-Type')}")
        print(f"Content-Length: {len(response.content)} bytes")

        # Check for React indicators
        content = response.text.lower()
        react_found = 'react' in content or 'root' in content

        # Check for app-specific content
        has_app_content = any(keyword in content for keyword in [
            'linkedin', 'pilot', 'dashboard', 'campaigns', 'posts'
        ])

        print(f"\nReact App Detected: {'✓' if react_found else '✗'}")
        print(f"App Content Found: {'✓' if has_app_content else '✗'}")

        if response.status_code == 200:
            print("\n✓ Frontend loads successfully")
            return True
        else:
            print(f"\n✗ Frontend returned {response.status_code}")
            return False

    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def test_api_base():
    """Test the base API endpoint"""
    print_header("API Base Endpoint Test")

    try:
        response = requests.get(f"{BASE_URL}/api/", timeout=10)
        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            print("\n✓ API is responding")
            return True
        else:
            print(f"✗ Unexpected status: {response.status_code}")
            return False

    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def test_authenticated_endpoints():
    """Test endpoints that require authentication"""
    print_header("Authentication-Required Endpoints")

    endpoints = [
        "/api/campaigns",
        "/api/posts",
        "/api/drafts",
        "/api/scheduled-posts",
        "/api/linkedin/profile",
        "/api/organizations",
    ]

    results = []
    for endpoint in endpoints:
        print_subheader(f"Testing: {endpoint}")
        try:
            response = requests.get(f"{BASE_URL}{endpoint}", timeout=10)
            status = response.status_code

            print(f"Status: {status}")

            # 401/403 = auth required (expected, endpoint exists)
            # 422 = validation error (expected, endpoint exists)
            # 404 = not found (endpoint doesn't exist)
            # 200 = success (shouldn't happen without auth)

            if status in [401, 403, 422]:
                print("✓ Endpoint exists (requires authentication)")
                results.append(True)
            elif status == 200:
                print("✓ Endpoint accessible (may be open endpoint)")
                results.append(True)
            elif status == 404:
                print("✗ Endpoint not found")
                results.append(False)
            else:
                print(f"? Unexpected status: {status}")
                results.append(False)

        except Exception as e:
            print(f"✗ Error: {e}")
            results.append(False)

    passed = sum(results)
    total = len(results)
    print(f"\n{passed}/{total} endpoints are properly configured")
    return passed > total / 2

def test_public_endpoints():
    """Test public/unauthenticated endpoints"""
    print_header("Public Endpoints Test")

    endpoints = [
        ("/api/", "API Root"),
        ("/api/health", "Health Check"),
    ]

    results = []
    for endpoint, description in endpoints:
        print_subheader(f"{description}: {endpoint}")
        try:
            response = requests.get(f"{BASE_URL}{endpoint}", timeout=10)
            print(f"Status: {response.status_code}")

            if response.status_code == 200:
                try:
                    data = response.json()
                    print(f"Response: {json.dumps(data, indent=2)}")
                except:
                    print(f"Response: {response.text[:200]}")
                print("✓ Accessible")
                results.append(True)
            elif response.status_code == 404:
                print("✗ Not found")
                results.append(False)
            else:
                print(f"? Status {response.status_code}")
                results.append(False)

        except Exception as e:
            print(f"✗ Error: {e}")
            results.append(False)

    return any(results)

def test_static_assets():
    """Test if static assets are being served"""
    print_header("Static Assets Test")

    try:
        # Get main page to find asset references
        response = requests.get(BASE_URL, timeout=10)
        content = response.text

        # Look for common static file references
        import re

        js_files = re.findall(r'src="(/static/js/[^"]+)"', content)
        css_files = re.findall(r'href="(/static/css/[^"]+)"', content)

        print(f"Found {len(js_files)} JS files")
        print(f"Found {len(css_files)} CSS files")

        # Test loading one of each if found
        tested = []

        if js_files:
            js_url = f"{BASE_URL}{js_files[0]}"
            print(f"\nTesting JS: {js_files[0]}")
            js_response = requests.head(js_url, timeout=10)
            print(f"Status: {js_response.status_code}")
            tested.append(js_response.status_code == 200)

        if css_files:
            css_url = f"{BASE_URL}{css_files[0]}"
            print(f"\nTesting CSS: {css_files[0]}")
            css_response = requests.head(css_url, timeout=10)
            print(f"Status: {css_response.status_code}")
            tested.append(css_response.status_code == 200)

        if tested and all(tested):
            print("\n✓ Static assets are loading")
            return True
        elif tested:
            print("\n⚠ Some static assets loading, some not")
            return True
        else:
            print("\n⚠ Could not verify static assets")
            return False

    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def test_ssl_certificate():
    """Test SSL/HTTPS configuration"""
    print_header("SSL/HTTPS Configuration")

    try:
        response = requests.get(BASE_URL, timeout=10)

        # Check if HTTPS is working
        if response.url.startswith('https://'):
            print("✓ HTTPS is enabled")
            print(f"Final URL: {response.url}")

            # Check security headers
            print("\nSecurity Headers:")
            security_headers = [
                'Strict-Transport-Security',
                'X-Frame-Options',
                'X-Content-Type-Options',
                'Content-Security-Policy'
            ]

            for header in security_headers:
                value = response.headers.get(header, 'Not set')
                print(f"  {header}: {value}")

            return True
        else:
            print("⚠ Not using HTTPS")
            return False

    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def test_cors_configuration():
    """Test CORS configuration"""
    print_header("CORS Configuration")

    try:
        headers = {
            'Origin': 'http://localhost:3000',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Content-Type'
        }

        response = requests.options(f"{BASE_URL}/api/", headers=headers, timeout=10)

        print(f"Preflight Status: {response.status_code}")

        cors_headers = {
            'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
            'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
            'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers'),
            'Access-Control-Allow-Credentials': response.headers.get('Access-Control-Allow-Credentials')
        }

        print("\nCORS Headers:")
        for header, value in cors_headers.items():
            status = "✓" if value else "✗"
            print(f"  {status} {header}: {value or 'Not set'}")

        has_cors = any(cors_headers.values())

        if has_cors:
            print("\n✓ CORS is configured")
            return True
        else:
            print("\n✗ CORS not configured")
            return False

    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def test_response_times():
    """Test API response times"""
    print_header("Performance - Response Times")

    endpoints = [
        "/",
        "/api/",
    ]

    results = []
    for endpoint in endpoints:
        try:
            import time
            start = time.time()
            response = requests.get(f"{BASE_URL}{endpoint}", timeout=10)
            duration = (time.time() - start) * 1000  # Convert to ms

            print(f"\n{endpoint}")
            print(f"  Status: {response.status_code}")
            print(f"  Time: {duration:.0f}ms")

            if duration < 500:
                print(f"  Performance: ✓ Excellent")
            elif duration < 1000:
                print(f"  Performance: ✓ Good")
            elif duration < 2000:
                print(f"  Performance: ⚠ Acceptable")
            else:
                print(f"  Performance: ✗ Slow")

            results.append(duration < 2000)

        except Exception as e:
            print(f"✗ Error: {e}")
            results.append(False)

    return any(results)

def main():
    print("="*70)
    print("LinkedIn Pilot - Live Application Test")
    print(f"URL: {BASE_URL}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70)

    results = {
        "Frontend Loading": test_frontend_loading(),
        "API Base": test_api_base(),
        "Public Endpoints": test_public_endpoints(),
        "Authenticated Endpoints": test_authenticated_endpoints(),
        "Static Assets": test_static_assets(),
        "SSL/HTTPS": test_ssl_certificate(),
        "CORS": test_cors_configuration(),
        "Response Times": test_response_times(),
    }

    print_header("Final Test Summary")

    for test_name, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{test_name:30} {status}")

    passed_count = sum(results.values())
    total_count = len(results)
    percentage = (passed_count / total_count * 100) if total_count > 0 else 0

    print(f"\n{'='*70}")
    print(f"Total: {passed_count}/{total_count} tests passed ({percentage:.1f}%)")
    print('='*70)

    if percentage >= 80:
        print("\n✓ Application is working well!")
    elif percentage >= 60:
        print("\n⚠ Application is partially working - some issues found")
    else:
        print("\n✗ Application has significant issues")

    print(f"\nAccess your app at: {BASE_URL}")

if __name__ == "__main__":
    main()
