# Coding Agent

An AI coding agent that researches before writing code — so it never recommends deprecated libraries or hallucinated APIs.

Instead of generating code from stale training data, this agent uses BrowseAI to search the web, verify that recommended packages actually exist on PyPI, check for deprecation notices, and only then generates code using verified libraries.

## How it works

The agent runs three phases for every coding task:

### Phase 1: Research

The agent uses `session.ask()` with `depth="thorough"` to search the web for the best libraries and frameworks for your task. Thorough mode automatically rephrases and retries the query when initial confidence is below 60%, ensuring high-quality results.

The output includes:
- Recommended libraries with their features
- Confidence score (8-factor evidence-based algorithm)
- Number of verified claims and sources consulted
- Any contradictions found in the research

### Phase 2: Verification

Every library mentioned in the research is individually verified:
- Does the package exist on PyPI?
- Is it deprecated or archived?
- What is the latest version?
- When was the last release?

Libraries that fail verification are flagged and excluded from code generation.

### Phase 3: Code Generation

The agent generates code using ONLY verified, actively maintained libraries. Each library choice is backed by citations showing why it was selected, with consensus levels and source counts.

## The problem this solves

Traditional coding agents generate code from LLM training data, which leads to:
- Recommending packages that don't exist (hallucinated package names)
- Using deprecated libraries (training data is months or years old)
- Calling APIs that were removed in newer versions
- Missing better alternatives released after the training cutoff

With BrowseAI, every `import` in the generated code maps to a real, maintained package.

## Setup

```bash
pip install -r requirements.txt
```

Set your API key:

```bash
export BROWSEAI_API_KEY=bai_xxx
```

Or the script will prompt you for it.

## Usage

### Pass a task as an argument

```bash
python agent.py "Build a WebSocket server in Python"
```

### Interactive mode

```bash
python agent.py
# What should I build? Build a rate limiter in Python
```

### Chain multiple tasks in one session

The agent uses BrowseAI sessions, so knowledge accumulates. After the first task completes, you can enter another task that builds on what the agent already learned:

```bash
python agent.py "Build a WebSocket server in Python"
# After it finishes:
# Another task? (enter to quit): Add JWT authentication to the WebSocket server
```

The second task benefits from the session's prior knowledge about WebSocket libraries.

## Example: Build a WebSocket server in Python

```bash
python agent.py "Build a WebSocket server in Python"
```

### What happens

**Phase 1 — Research:**
The agent searches the web and finds that `websockets` is the standard async WebSocket library for Python. It also discovers `aiohttp` as an alternative with broader HTTP support, and notes that `socket.io` (via `python-socketio`) is popular for real-time apps.

```
Research Findings

The most popular Python WebSocket libraries are:
- `websockets` — Pure Python, async, standards-compliant (RFC 6455)
- `aiohttp` — Full HTTP client/server with WebSocket support
- `python-socketio` — Socket.IO protocol implementation
...

Confidence: ████████████░░░ 78%
Verified claims: 5/6
Sources consulted: 7
```

**Phase 2 — Verification:**
Each library is checked against PyPI and the web:

```
Library Verification Results
┌──────────────────┬──────────┬────────────┬──────────────────────────┐
│ Library          │ Status   │ Confidence │ Notes                    │
├──────────────────┼──────────┼────────────┼──────────────────────────┤
│ websockets       │ VERIFIED │ ████████ … │ Latest 13.x, actively…  │
│ aiohttp          │ VERIFIED │ ███████░ … │ Latest 3.x, maintained… │
│ python-socketio  │ VERIFIED │ ███████░ … │ Latest 5.x, active…     │
└──────────────────┴──────────┴────────────┴──────────────────────────┘
```

**Phase 3 — Code Generation:**
The agent generates a working WebSocket server using `websockets` (the top-verified choice):

```python
import asyncio
import websockets
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("websocket-server")

CONNECTIONS: set[websockets.WebSocketServerProtocol] = set()

async def handler(websocket: websockets.WebSocketServerProtocol) -> None:
    CONNECTIONS.add(websocket)
    logger.info(f"Client connected ({len(CONNECTIONS)} total)")
    try:
        async for message in websocket:
            data = json.loads(message)
            logger.info(f"Received: {data}")
            response = json.dumps({"echo": data, "clients": len(CONNECTIONS)})
            await websocket.send(response)
    except websockets.ConnectionClosed:
        logger.info("Client disconnected")
    finally:
        CONNECTIONS.remove(websocket)

async def main() -> None:
    async with websockets.serve(handler, "localhost", 8765):
        logger.info("WebSocket server running on ws://localhost:8765")
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
```

**Why `websockets`?**
- Most downloaded async WebSocket library for Python (consensus: high, 5 sources)
- Standards-compliant RFC 6455 implementation (consensus: medium, 3 sources)

**Comparison — Without vs With BrowseAI:**

```
┌─────────────────────────┐  ┌─────────────────────────┐
│ Without BrowseAI        │  │ With BrowseAI           │
│                         │  │                         │
│ 1. Agent receives task  │  │ 1. Agent receives task  │
│ 2. LLM generates code   │  │ 2. Researches libraries │
│ 3. Might recommend      │  │ 3. Verifies on PyPI     │
│    deprecated packages  │  │ 4. Checks deprecation   │
│ 4. Might hallucinate    │  │ 5. Confirms latest APIs │
│    non-existent APIs    │  │ 6. Generates with cites │
│ 5. No verification     │  │                         │
│                         │  │ Result: Every import    │
│ Risk: Code breaks at    │  │ maps to a real package  │
│ install or runtime      │  │ with verified APIs      │
└─────────────────────────┘  └─────────────────────────┘
```

## Sessions: Knowledge that persists

The agent creates a BrowseAI session called `coding-agent`. Each research query adds verified claims to the session's knowledge graph. When you ask a follow-up task, the session recalls relevant prior knowledge automatically.

This means:
- The agent doesn't re-research libraries it already verified
- Follow-up tasks can reference prior findings
- You can export the session's accumulated knowledge

## More tasks to try

```bash
python agent.py "Build a rate limiter in Python"
python agent.py "Create a REST API with JWT authentication"
python agent.py "Build a CLI tool with auto-complete"
python agent.py "Create a background task queue"
python agent.py "Build a database migration system"
python agent.py "Create a real-time chat application"
```

## Requirements

- Python 3.10+
- A [BrowseAI API key](https://browseai.dev) (`bai_xxx` prefix)
- Dependencies: `browseaidev`, `rich`

## License

MIT — part of the [BrowseAI](https://github.com/BrowseAI-HQ/BrowserAI-Dev) project.
