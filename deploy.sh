#!/bin/bash

# LinkedIn Pilot Deployment Script
# Server: 138.197.35.30
# This script sets up the complete production environment

set -e  # Exit on error

echo "=========================================="
echo "LinkedIn Pilot - Production Deployment"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/var/www/linkedin-pilot"
DOMAIN="138.197.35.30"  # Change this if you have a domain

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${BLUE}➜ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Step 1: Update system
print_info "Updating system packages..."
apt-get update
apt-get upgrade -y
print_success "System updated"

# Step 2: Install Node.js 20.x (LTS)
print_info "Installing Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    print_success "Node.js installed: $(node -v)"
else
    print_success "Node.js already installed: $(node -v)"
fi

# Step 3: Install Python 3.11 and pip
print_info "Installing Python..."
apt-get install -y python3.11 python3.11-venv python3-pip
print_success "Python installed: $(python3 --version)"

# Step 4: Install MongoDB
print_info "Installing MongoDB..."
if ! command -v mongod &> /dev/null; then
    wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | apt-key add -
    echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    apt-get update
    apt-get install -y mongodb-org
    systemctl start mongod
    systemctl enable mongod
    print_success "MongoDB installed and started"
else
    print_success "MongoDB already installed"
fi

# Step 5: Install Nginx
print_info "Installing Nginx..."
apt-get install -y nginx
systemctl enable nginx
print_success "Nginx installed"

# Step 6: Install PM2 globally
print_info "Installing PM2..."
npm install -g pm2
print_success "PM2 installed"

# Step 7: Create application directory
print_info "Creating application directory..."
mkdir -p $APP_DIR
cd $APP_DIR
print_success "Application directory created: $APP_DIR"

# Step 8: Set up firewall
print_info "Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
print_success "Firewall configured"

print_success "Server setup complete!"
echo ""
echo "=========================================="
echo "Next Steps:"
echo "1. Copy your application files to $APP_DIR"
echo "2. Set up environment variables"
echo "3. Install dependencies"
echo "4. Build frontend"
echo "5. Start services with PM2"
echo "6. Configure Nginx"
echo "=========================================="



