#!/bin/bash
set -e

echo "=================================================================="
echo "  SECURE INFRASTRUCTURE ACCESS MANAGEMENT - ONE-CLICK EC2 SETUP   "
echo "=================================================================="

# 1. Detect Host Public IP or Accept Custom Domain Parameter
if [ -n "$1" ]; then
  HOST_ADDRESS="$1"
  echo "[+] Using custom domain / host: ${HOST_ADDRESS}"
else
  HOST_ADDRESS=$(curl -s ifconfig.me || curl -s http://checkip.amazonaws.com || echo "localhost")
  echo "[+] Detected Public IP: ${HOST_ADDRESS}"
fi

# 2. Update System & Install Core Packages
echo "[+] Updating system packages..."
sudo apt-get update -y
sudo apt-get install -y curl git ufw python3 python3-pip python3-venv

# 3. Install Node.js (v20 LTS) & Global PM2
if ! command -v node &> /dev/null; then
  echo "[+] Installing Node.js 20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
sudo npm install -g pm2

# 4. Install Docker & Docker Compose
if ! command -v docker &> /dev/null; then
  echo "[+] Installing Docker and Docker Compose..."
  sudo apt-get install -y docker.io docker-compose-v2
  sudo usermod -aG docker $USER
fi

# 5. Configure Root & Service Environment Files
echo "[+] Configuring production environment variables..."
if [ ! -f .env ]; then
  cp .env.example .env
fi

# Update Master Environment Variables
sed -i "s|VITE_API_URL=.*|VITE_API_URL=http://${HOST_ADDRESS}:3000/api|g" .env
sed -i "s|BACKEND_URL=.*|BACKEND_URL=http://localhost:3000|g" .env
sed -i "s|EMAIL_USER=.*|EMAIL_USER=goyalankitgoyal32@gmail.com|g" .env
sed -i "s|EMAIL_APP_PASSWORD=.*|EMAIL_APP_PASSWORD=badpcznewqgdmiqe|g" .env
sed -i "s|ADMIN_EMAIL=.*|ADMIN_EMAIL=goyalankitgoyal32@gmail.com|g" .env
sed -i "s|ADMIN_PASSWORD=.*|ADMIN_PASSWORD=AnkitAdmin2026!|g" .env

# Configure Backend .env
cat <<EOF > backend/.env
PORT=3000
NODE_ENV=production
DATABASE_URL=postgres://secure_gateway_user:change_me@localhost:5433/secure_gateway
REDIS_URL=redis://localhost:6379
JWT_SECRET=super_secure_random_hash_key_1234
GATEWAY_API_KEY=gateway_secret_key_5678
CREDENTIAL_ENCRYPTION_KEY=super_secure_vault_master_key_2026_aes256
EMAIL_USER=goyalankitgoyal32@gmail.com
EMAIL_APP_PASSWORD=badpcznewqgdmiqe
ADMIN_EMAIL=goyalankitgoyal32@gmail.com
ADMIN_PASSWORD=AnkitAdmin2026!
ADMIN_NAME=Ankit Goyal (Admin)
EOF

# Configure Frontend .env
cat <<EOF > frontend/.env
VITE_API_URL=http://${HOST_ADDRESS}:3000/api
VITE_ENABLE_DEMO_LOGIN=false
EOF

# 6. Launch Docker Containers (Postgres, Redis, Monitoring, 4 Target Servers)
echo "[+] Starting Dockerized database, redis, and 4 target servers..."
sudo docker compose up -d

# Wait for PostgreSQL to be ready
echo "[+] Waiting for PostgreSQL database to be healthy..."
until sudo docker exec secure-gateway-db pg_isready -U secure_gateway_user -d secure_gateway > /dev/null 2>&1; do
  echo "    Waiting for PostgreSQL container..."
  sleep 3
done
echo "[+] PostgreSQL is healthy and accepting connections!"

# 7. Install Backend & Seed Database
echo "[+] Installing backend dependencies & seeding database..."
cd backend
npm install
node seed.js
cd ..

# 8. Setup Python Virtual Environment for SSH Gateway
echo "[+] Setting up Python SSH Gateway virtual environment..."
cd gateway
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
deactivate
cd ..

# 9. Build Frontend Static Assets
echo "[+] Building frontend web application..."
cd frontend
npm install
npm run build
cd ..

# 10. Start Everything with PM2
echo "[+] Starting services with PM2 process manager..."
# Backend
pm2 delete pam-backend 2>/dev/null || true
pm2 start "node src/app.js" --name "pam-backend" --cwd "$(pwd)/backend"

# SSH Gateway
pm2 delete pam-gateway 2>/dev/null || true
pm2 start "$(pwd)/gateway/.venv/bin/python3 -m app.main" --name "pam-gateway" --cwd "$(pwd)/gateway"

# Frontend Web Preview
pm2 delete pam-frontend 2>/dev/null || true
pm2 start "npm run preview -- --host 0.0.0.0 --port 5173" --name "pam-frontend" --cwd "$(pwd)/frontend"

pm2 save

echo ""
echo "=================================================================="
echo "🎉 DEPLOYMENT COMPLETE & ALL SERVICES RUNNING!"
echo "=================================================================="
echo "🌐 Web Portal:         http://${HOST_ADDRESS}:5173"
echo "🔑 Super Admin Email:  goyalankitgoyal32@gmail.com"
echo "🔒 Super Admin Pass:   AnkitAdmin2026!"
echo "📧 Gmail OTP Login:    Supported (sent to your real Gmail)"
echo "------------------------------------------------------------------"
echo "💻 SSH Bastion Command (Connect from any terminal in the world):"
echo "   ssh employee_1_server_1@${HOST_ADDRESS} -p 2222"
echo "   Password: employee123"
echo "------------------------------------------------------------------"
echo "📊 Monitoring Metrics: http://${HOST_ADDRESS}:3001"
echo "📈 Grafana Dashboards: http://${HOST_ADDRESS}:3002 (admin / change_grafana_master_password_in_production)"
echo "=================================================================="

