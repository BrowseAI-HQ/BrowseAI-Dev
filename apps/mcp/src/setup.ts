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
  browse-ai setup
  ================
  Configure browse-ai for Claude Desktop / Cursor / Windsurf
`);

  const browseKey = await ask(
    "  BrowseAI Dev API key (leave blank to use your own Tavily + OpenRouter keys):"
  );

  let mcpEnv: Record<string, string>;

  if (browseKey.trim()) {
    mcpEnv = { BROWSE_API_KEY: browseKey.trim() };
  } else {
    const serpKey = await ask("  Tavily API key (get one at https://tavily.com): ");
    if (!serpKey.trim()) {
      console.log("\n  Tavily API key is required. Get one at https://tavily.com\n");
      process.exit(1);
    }

    const openrouterKey = await ask(
      "  OpenRouter API key (get one at https://openrouter.ai): "
    );
    if (!openrouterKey.trim()) {
      console.log(
        "\n  OpenRouter API key is required. Get one at https://openrouter.ai\n"
      );
      process.exit(1);
    }

    mcpEnv = {
      SERP_API_KEY: serpKey.trim(),
      OPENROUTER_API_KEY: openrouterKey.trim(),
    };
  }

  rl.close();

  const mcpEntry = {
    command: "npx",
    args: ["-y", "browse-ai"],
    env: mcpEnv,
  };

  const configPath = getConfigPath();
  console.log(`\n  Config path: ${configPath}`);

  let config: any = { mcpServers: {} };

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

  config.mcpServers["browse-ai"] = mcpEntry;
  writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log(`
  Done! browse-ai has been configured.

  Next steps:
    1. Restart Claude Desktop
    2. You should see "browse-ai" in the MCP tools list
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
