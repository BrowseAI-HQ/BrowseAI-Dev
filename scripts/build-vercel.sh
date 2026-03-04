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
mkdir -p .vercel/output/static
mkdir -p .vercel/output/functions/api.func

# 4. Copy static files
cp -r dist/* .vercel/output/static/

# 5. Bundle API function with esbuild (CommonJS for max compatibility)
echo "Step 3: Bundling API function..."
pnpm exec esbuild api/index.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --format=cjs \
  --outfile=.vercel/output/functions/api.func/index.js \
  --packages=bundle

# 6. Function config
cat > .vercel/output/functions/api.func/.vc-config.json << 'EOF'
{
  "runtime": "nodejs20.x",
  "handler": "index.js",
  "launcherType": "Nodejs",
  "maxDuration": 30
}
EOF

# 7. Route config
cat > .vercel/output/config.json << 'EOF'
{
  "version": 3,
  "routes": [
    { "src": "/api(.*)", "dest": "/api" },
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
EOF

# 8. Write build debug info to static for verification
echo "{\"built_at\":\"$(date -u)\",\"function_size\":\"$(wc -c < .vercel/output/functions/api.func/index.js)\",\"static_files\":$(ls .vercel/output/static/ | wc -l),\"config\":$(cat .vercel/output/config.json)}" > .vercel/output/static/_build-info.json

echo "=== Build complete ==="
echo "Static files:" && ls .vercel/output/static/
echo "Function files:" && ls -la .vercel/output/functions/api.func/
echo "Config:" && cat .vercel/output/config.json
