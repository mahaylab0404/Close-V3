# Closr Backend Setup Guide

## Prerequisites
- Node.js 18+ installed
- Cloudflare account ([sign up free](https://dash.cloudflare.com/sign-up))

## Step 1: Install Dependencies

```bash
cd /Users/zc/Downloads/closr---senior-centered-real-estate
npm install
```

## Step 2: Set Up Cloudflare D1 Database

```bash
# Install Wrangler CLI (if not already installed)
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create D1 database
wrangler d1 create closr_production

# Copy the database_id from the output and paste it into wrangler.toml
# It will look like: database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# Run the schema to create tables
wrangler d1 execute closr_production --file=./schema.sql
```

## Step 3: Set Secrets

```bash
# Set JWT secret (use a strong random string)
wrangler secret put JWT_SECRET
# When prompted, paste: your_super_secret_jwt_key_here_make_it_random

# Set Gemini API key
wrangler secret put GEMINI_API_KEY
# When prompted, paste your Gemini API key from https://aistudio.google.com/apikey
```

## Step 4: Test Locally

```bash
# Start local development server
wrangler dev

# In another terminal, test the API:
curl http://localhost:8787/api/health
# Should return: {"status":"ok","service":"closr-api"}
```

## Step 5: Test Registration

```bash
# Register a test agent
curl -X POST http://localhost:8787/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "name": "Test Agent",
    "licenseNumber": "BK1234567",
    "county": "Miami-Dade"
  }'

# Should return agent data + JWT token
```

## Step 6: Deploy to Production

```bash
# Deploy to Cloudflare Workers
wrangler deploy

# Your API will be live at: https://closr-api.YOUR_SUBDOMAIN.workers.dev
```

## Environment Variables

For production deployment, update `.env.local` with your API URL:

```env
VITE_API_URL=https://closr-api.YOUR_SUBDOMAIN.workers.dev
```

## Next Steps

1. Update frontend to use the new API endpoints
2. Implement Florida API integrations in `functions/api/leads.ts`
3. Add agent login UI component
4. Test end-to-end agent registration flow
