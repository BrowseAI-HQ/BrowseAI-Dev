#!/bin/bash
set -e

echo "=== Building for Vercel (Build Output API v3) ==="

# Clean ALL output directories
rm -rf .vercel/output dist

# 1. Create output structure
mkdir -p .vercel/output/static
mkdir -p .vercel/output/functions/api/mcp.func

# 2. Build Vite frontend directly into .vercel/output/static
echo "Step 1: Building frontend..."
pnpm exec vite build --outDir .vercel/output/static

# 3. Bundle MCP function (HTTP-only, calls engine API)
echo "Step 2: Bundling MCP function..."
pnpm exec esbuild api/mcp.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --format=cjs \
  --outfile=.vercel/output/functions/api/mcp.func/index.js \
  --packages=bundle

# 4. MCP function config
cat > .vercel/output/functions/api/mcp.func/.vc-config.json << 'EOF'
{
  "runtime": "nodejs20.x",
  "handler": "index.js",
  "launcherType": "Nodejs",
  "maxDuration": 300,
  "supportsResponseStreaming": true
}
EOF

# 5. Route config — /api/mcp served locally, /api/* proxied to engine
ENGINE_URL="${ENGINE_URL:-https://browseaidev-engine.vercel.app}"
cat > .vercel/output/config.json << CONF
{
  "version": 3,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" }
      ]
    }
  ],
  "routes": [
    { "src": "/api/mcp", "dest": "/api/mcp" },
    { "src": "/api/(.*)", "dest": "${ENGINE_URL}/api/\$1" },
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
CONF

# 6. Write build verification file
echo '{"built":true}' > .vercel/output/static/_build-info.json

# 7. Ensure NO dist/ directory exists (Vercel might use it instead)
rm -rf dist

echo "=== Build complete ==="
echo "Static:" && ls .vercel/output/static/
echo "MCP Function:" && ls .vercel/output/functions/api/mcp.func/
echo "Config:" && cat .vercel/output/config.json
