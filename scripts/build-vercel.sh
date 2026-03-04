#!/bin/bash
set -e

echo "=== Building for Vercel (Build Output API v3) ==="

# Clean previous output
rm -rf .vercel/output dist

# 1. Build shared package
echo "Step 1: Building @browse/shared..."
pnpm --filter @browse/shared build

# 2. Build Vite frontend
echo "Step 2: Building frontend..."
pnpm exec vite build

# 3. Create output structure
echo "Step 3: Creating Build Output structure..."
mkdir -p .vercel/output/static
mkdir -p .vercel/output/functions/api.func

# 4. Copy static files
cp -r dist/* .vercel/output/static/

# 5. Bundle API function with esbuild (all deps inlined)
echo "Step 4: Bundling API function..."
pnpm exec esbuild api/index.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --format=esm \
  --outfile=.vercel/output/functions/api.func/index.mjs \
  --packages=bundle

# 6. Function config
cat > .vercel/output/functions/api.func/.vc-config.json << 'EOF'
{
  "runtime": "nodejs20.x",
  "handler": "index.mjs",
  "launcherType": "Nodejs",
  "maxDuration": 30
}
EOF

# 7. Route config
cat > .vercel/output/config.json << 'EOF'
{
  "version": 3,
  "routes": [
    { "src": "/api/(.*)", "dest": "/api" },
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
EOF

echo "=== Build complete ==="
echo "Static files:"
ls .vercel/output/static/
echo "Function:"
ls -la .vercel/output/functions/api.func/
