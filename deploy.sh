#!/bin/bash
# ====== Arewaflix API Deploy Script ======
# Place this file in your app root (no cd required)
# Usage: ./deploy.sh

set -euo pipefail

APP_NAME="arewaflix-api"

echo "🚀 Deploy: $APP_NAME"

echo "📦 Installing dependencies (production)..."
pnpm install || { echo "npm install failed"; exit 1; }

echo "🛑 Stopping PM2 process (if running)..."
pm2 stop "$APP_NAME" 2>/dev/null || echo "No running process to stop."

echo "🗑️ Deleting PM2 process (if exists)..."
pm2 delete "$APP_NAME" 2>/dev/null || echo "No process to delete."

echo "♻️ Starting app with PM2 (npm start)..."
pm2 start npm --name "$APP_NAME" -- start

echo "💾 Saving PM2 process list..."
pm2 save

echo "🔎 Current status:"
pm2 status "$APP_NAME" || pm2 list

echo "✅ Deployment completed successfully."
