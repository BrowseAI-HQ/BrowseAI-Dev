#!/bin/bash
set -e

echo "=== Building for Vercel (Build Output API v3) ==="

# Clean ALL output directories
rm -rf .vercel/output dist

# 1. Build shared package
echo "Step 1: Building @browse/shared..."
pnpm --filter @browse/shared build

# 2. Create output structure FIRST
mkdir -p .vercel/output/static
mkdir -p .vercel/output/functions/api.func
mkdir -p .vercel/output/functions/api/mcp.func

# 3. Build Vite frontend directly into .vercel/output/static
echo "Step 2: Building frontend..."
pnpm exec vite build --outDir .vercel/output/static

# 4. Bundle API function with esbuild (CJS for compatibility)
echo "Step 3: Bundling API function..."
pnpm exec esbuild api/index.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --format=cjs \
  --outfile=.vercel/output/functions/api.func/index.js \
  --packages=bundle

# 4b. Bundle MCP function separately
echo "Step 3b: Bundling MCP function..."
pnpm exec esbuild api/mcp.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --format=cjs \
  --outfile=.vercel/output/functions/api/mcp.func/index.js \
  --packages=bundle

# 5. Function configs
cat > .vercel/output/functions/api.func/.vc-config.json << 'EOF'
{
  "runtime": "nodejs20.x",
  "handler": "index.js",
  "launcherType": "Nodejs",
  "maxDuration": 300,
  "supportsResponseStreaming": true
}
EOF

cat > .vercel/output/functions/api/mcp.func/.vc-config.json << 'EOF'
{
  "runtime": "nodejs20.x",
  "handler": "index.js",
  "launcherType": "Nodejs",
  "maxDuration": 300,
  "supportsResponseStreaming": true
}
EOF

# 6. Route config
cat > .vercel/output/config.json << 'EOF'
{
  "version": 3,
  "routes": [
    { "src": "/api/mcp", "dest": "/api/mcp" },
    { "src": "/api(.*)", "dest": "/api" },
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
EOF

# 7. Write build verification file
echo '{"built":true}' > .vercel/output/static/_build-info.json

# 8. Ensure NO dist/ directory exists (Vercel might use it instead)
rm -rf dist

echo "=== Build complete ==="
echo "Static:" && ls .vercel/output/static/
echo "Function:" && ls .vercel/output/functions/api.func/
echo "Config:" && cat .vercel/output/config.json
