"""BrowseAI CLI — quick setup and testing."""

from __future__ import annotations

import argparse
import json
import sys


def cmd_setup(args: argparse.Namespace) -> None:
    """Interactive setup — store API keys in ~/.browseai.json."""
    import os

    config_path = os.path.expanduser("~/.browseai.json")

    print()
    print("  browseai setup")
    print("  ==============")
    print("  Configure the BrowseAI Python SDK\n")

    api_key = input("  BrowseAI API key (leave blank to use your own keys): ").strip()

    config: dict[str, str] = {}

    if api_key:
        config["api_key"] = api_key
    else:
        tavily_key = input("  Tavily API key (get one at https://tavily.com): ").strip()
        if not tavily_key:
            print("\n  Tavily API key is required. Get one at https://tavily.com\n")
            sys.exit(1)

        openrouter_key = input("  OpenRouter API key (get one at https://openrouter.ai): ").strip()
        if not openrouter_key:
            print("\n  OpenRouter API key is required. Get one at https://openrouter.ai\n")
            sys.exit(1)

        config["tavily_key"] = tavily_key
        config["openrouter_key"] = openrouter_key

    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)
    os.chmod(config_path, 0o600)

    print(f"""
  Done! Config saved to {config_path}

  Quick start:

    from browseai import BrowseAI

    client = BrowseAI.from_config()
    result = client.ask("What is quantum computing?")
    print(result.answer)

  Or test it now:

    browseai ask "What is quantum computing?"
""")


def cmd_ask(args: argparse.Namespace) -> None:
    """Run a query via the CLI."""
    from .client import BrowseAI

    client = BrowseAI.from_config()
    result = client.ask(args.query)

    print(f"\n  Answer (confidence: {result.confidence:.0%}):\n")
    print(f"  {result.answer}\n")

    if result.sources:
        print(f"  Sources ({len(result.sources)}):")
        for s in result.sources:
            print(f"    - {s.title} ({s.url})")

    if result.claims:
        print(f"\n  Claims ({len(result.claims)}):")
        for c in result.claims:
            print(f"    - {c.claim}")

    print()
    client.close()


def cmd_search(args: argparse.Namespace) -> None:
    """Search the web via the CLI."""
    from .client import BrowseAI

    client = BrowseAI.from_config()
    results = client.search(args.query, limit=args.limit)

    print(f"\n  Results ({len(results)}):\n")
    for i, r in enumerate(results, 1):
        print(f"  {i}. {r.title}")
        print(f"     {r.url}")
        print(f"     {r.content[:120]}...")
        print()

    client.close()


def cmd_version(args: argparse.Namespace) -> None:
    from . import __version__
    print(f"browseai {__version__}")


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="browseai",
        description="BrowseAI Dev — Reliable research infrastructure for AI agents",
    )
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("setup", help="Configure API keys")
    sub.add_parser("version", help="Show version")

    ask_parser = sub.add_parser("ask", help="Ask a question with cited answer")
    ask_parser.add_argument("query", help="The question to answer")

    search_parser = sub.add_parser("search", help="Search the web")
    search_parser.add_argument("query", help="Search query")
    search_parser.add_argument("--limit", type=int, default=5, help="Max results")

    args = parser.parse_args()

    if args.command == "setup":
        cmd_setup(args)
    elif args.command == "ask":
        cmd_ask(args)
    elif args.command == "search":
        cmd_search(args)
    elif args.command == "version":
        cmd_version(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
