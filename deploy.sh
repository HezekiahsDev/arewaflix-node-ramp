#!/bin/bash
# ====== Arewaflix API Deploy Script ======
# Usage: ./deploy.sh

APP_NAME="arewaflix-api"

echo "🚀 Starting deployment for $APP_NAME..."

echo "🔧 Pulling latest changes (if using git)..."
git pull origin main || echo "Skipping git pull (not a git repo)"

echo "📦 Installing dependencies..."
npm install --production

echo "🛑 Stopping existing PM2 process..."
pm2 stop $APP_NAME || echo "No process found to stop"

echo "♻️ Starting app with PM2 (npm start)..."
pm2 start npm --name $APP_NAME -- start

echo "💾 Saving PM2 process list..."
pm2 save

echo "✅ Deployment complete!"
pm2 status $APP_NAME
