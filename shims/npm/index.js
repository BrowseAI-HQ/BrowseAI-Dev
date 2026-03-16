#!/usr/bin/env node

/**
 * browse-ai → browseai-dev redirect shim.
 *
 * This package has been renamed to browseai-dev.
 * All future development happens under the browseai-dev package.
 *
 *   npx browseai-dev   (recommended)
 *   npx browse-ai      (works, proxies to browseai-dev)
 */

console.warn(
  "\x1b[33m⚠ 'browse-ai' has been renamed to 'browseai-dev'.\n" +
  "  Please update: npx browseai-dev\x1b[0m\n"
);

const { execFileSync } = require("child_process");
const path = require("path");

// Forward to browseai-dev binary
const binPath = path.join(__dirname, "node_modules", ".bin", "browseai-dev");
try {
  execFileSync(binPath, process.argv.slice(2), { stdio: "inherit" });
} catch (err) {
  // Try global/npx resolution
  try {
    execFileSync("browseai-dev", process.argv.slice(2), { stdio: "inherit" });
  } catch {
    console.error("Could not find browseai-dev. Install it: npm install -g browseai-dev");
    process.exit(1);
  }
}
