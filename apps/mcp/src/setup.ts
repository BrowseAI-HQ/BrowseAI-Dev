import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { createInterface } from "readline";

const rl = createInterface({ input: process.stdin, output: process.stdout });
function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

function getConfigPath(): string {
  const platform = process.platform;
  const home = process.env.HOME || process.env.USERPROFILE || "";

  if (platform === "darwin") {
    return join(
      home,
      "Library",
      "Application Support",
      "Claude",
      "claude_desktop_config.json"
    );
  } else if (platform === "win32") {
    return join(
      process.env.APPDATA || join(home, "AppData", "Roaming"),
      "Claude",
      "claude_desktop_config.json"
    );
  } else {
    return join(home, ".config", "claude", "claude_desktop_config.json");
  }
}

export async function runSetup() {
  console.log(`
  browseai-dev setup
  ================
  Configure browseai-dev for Claude Desktop / Cursor / Windsurf
`);

  const browseKey = await ask(
    "  BrowseAI Dev API key (get one at https://browseai.dev/dashboard): "
  );

  if (!browseKey.trim()) {
    console.log("\n  BrowseAI Dev API key is required. Get one at https://browseai.dev/dashboard\n");
    process.exit(1);
  }

  const mcpEnv: Record<string, string> = { BROWSE_API_KEY: browseKey.trim() };

  rl.close();

  const mcpEntry = {
    command: "npx",
    args: ["-y", "browseai-dev"],
    env: mcpEnv,
  };

  const configPath = getConfigPath();
  console.log(`\n  Config path: ${configPath}`);

  let config: Record<string, unknown> & { mcpServers: Record<string, unknown> } = { mcpServers: {} };

  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, "utf-8"));
      if (!config.mcpServers) config.mcpServers = {};
    } catch {
      console.log("  Could not parse existing config, creating new one...");
    }
  } else {
    const dir = configPath.replace(/[/\\][^/\\]+$/, "");
    mkdirSync(dir, { recursive: true });
  }

  config.mcpServers["browseai-dev"] = mcpEntry;
  writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log(`
  Done! browseai-dev has been configured.

  Next steps:
    1. Restart Claude Desktop
    2. You should see "browseai-dev" in the MCP tools list
    3. Try asking: "Use browse_answer to explain quantum computing"

  Available tools:
    browse_search    - Search the web
    browse_open      - Fetch and parse a page
    browse_extract   - Extract knowledge from a page
    browse_answer    - Full deep research pipeline
    browse_compare   - Compare raw LLM vs evidence-backed answer

  Config written to: ${configPath}
`);
}
