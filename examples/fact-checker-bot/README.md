# Fact-Checker Bot

A Discord bot that verifies claims in real time using [BrowseAI](https://browseai.dev). Paste any claim and get an evidence-backed verdict with confidence scores, sources, and contradiction warnings.

## Commands

| Command | Description |
|---------|-------------|
| `!verify <claim>` | Verify a claim with thorough evidence-backed research |
| `!fact <claim>` | Alias for `!verify` |
| `!compare <claim>` | Show raw LLM answer vs evidence-backed answer side by side |

## Setup

### 1. Create a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**, give it a name like "Fact Checker"
3. Go to **Bot** tab, click **Reset Token**, and copy the token
4. Under **Privileged Gateway Intents**, enable **Message Content Intent**
5. Go to **OAuth2 > URL Generator**, select `bot` scope with permissions: Send Messages, Embed Links, Read Message History
6. Use the generated URL to invite the bot to your server

### 2. Get a BrowseAI API Key

Sign up at [browseai.dev](https://browseai.dev) and get your API key (starts with `bai_`).

### 3. Install and Run

```bash
# Clone the repo and navigate to this example
cd examples/fact-checker-bot

# Create a virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export DISCORD_BOT_TOKEN="your-discord-bot-token"
export BROWSEAI_API_KEY="bai_your_key_here"

# Run the bot
python bot.py
```

You can also create a `.env` file in this directory:

```env
DISCORD_BOT_TOKEN=your-discord-bot-token
BROWSEAI_API_KEY=bai_your_key_here
```

## How It Works

```
User sends: !verify The Great Wall of China is visible from space
                |
                v
    +---------------------------+
    |  BrowseAI ask() API       |
    |  depth="thorough"         |
    |                           |
    |  1. Web search (Tavily)   |
    |  2. Fetch top sources     |
    |  3. Extract claims + LLM  |
    |  4. Claim verification     |
    |  5. Cross-source consensus|
    |  6. Contradiction check   |
    |  7. Evidence-based scoring |
    |  8. Auto-retry if < 60%   |
    +---------------------------+
                |
                v
    Discord embed with verdict
```

Thorough mode automatically retries with a rephrased query if the first-pass confidence is below 60%, giving you higher quality results for tricky claims.

## Example Output

### `!verify` / `!fact`

```
+--------------------------------------------+
| FACT CHECK RESULT                          |
|--------------------------------------------|
| The claim that the Great Wall of China is  |
| visible from space is a common myth. While |
| the wall is very long, it is only about    |
| 15-30 feet wide, making it too narrow to   |
| be seen with the naked eye from low Earth  |
| orbit...                                   |
|                                            |
| VERDICT                                    |
| [red] Low Confidence (34%)                 |
|                                            |
| CLAIMS (1/4 verified)                      |
| [x] The Great Wall is visible from space   |
| [v] The wall is ~5,500 miles long          |
| [v] It is 15-30 feet wide                  |
| [x] Multiple astronauts have confirmed...  |
|                                            |
| SOURCES (6 total)                          |
| - NASA Science (nasa.gov)                  |
| - Scientific American (scientificamer...)  |
| - National Geographic (nationalgeogra...) |
|                                            |
| CONTRADICTIONS (1)                         |
| [!] Visibility from space                  |
|   > A: The wall is not visible from orbit  |
|   > B: Chinese textbooks claim visibility  |
|                                            |
| Powered by BrowseAI | browseai.dev        |
+--------------------------------------------+
```

### `!compare`

```
+--------------------------------------------+
| RAW LLM vs EVIDENCE-BACKED                |
|--------------------------------------------|
| Query: Coffee is bad for your health       |
|                                            |
| RAW LLM                                   |
| Coffee has both positive and negative      |
| health effects. Moderate consumption is    |
| generally considered safe...               |
| Confidence: 75% (self-assessed)            |
| Sources: 0 | Claims: 3                     |
|                                            |
| EVIDENCE-BACKED                            |
| Research shows moderate coffee consumption |
| (3-5 cups/day) is associated with reduced  |
| risk of several diseases including type 2  |
| diabetes and Parkinson's...                |
| Confidence: [green] High Confidence (82%)  |
| Sources: 8 | Claims: 6                     |
|                                            |
| CITATIONS                                  |
| - NEJM (nejm.org)                          |
| - Mayo Clinic (mayoclinic.org)             |
| - Harvard Health (health.harvard.edu)      |
|                                            |
| Powered by BrowseAI | browseai.dev        |
+--------------------------------------------+
```

## Architecture

The bot is intentionally simple -- a single `bot.py` file with no framework overhead:

- **`discord.py`** handles the Discord gateway connection and message events
- **`AsyncBrowseAIDev`** (the async Python SDK client) calls the BrowseAI Dev API without blocking the event loop
- The bot listens for `!verify`, `!fact`, and `!compare` prefixes, extracts the claim text, and dispatches to the appropriate handler
- Results are formatted into Discord embeds with color-coded confidence (green/yellow/red)
- The `typing()` context manager shows "Bot is typing..." while the API call is in progress

The heavy lifting (search, extraction, verification, confidence scoring) all happens server-side in BrowseAI. The bot is just a thin presentation layer.

## Tips

- **Thorough mode** takes 5-15 seconds because it does multi-pass research. Users see the typing indicator while it works.
- **Rate limits**: Without a BrowseAI API key, the demo limit is 1 query/hour. Get an API key for unlimited use.
- **Hosting**: For a production bot, run with `systemd`, Docker, or a cloud VM. The bot is stateless so it can restart freely.

## License

Apache 2.0 -- same as the parent BrowseAI Dev project.
