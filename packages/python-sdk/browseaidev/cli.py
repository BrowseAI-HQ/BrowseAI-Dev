"""BrowseAI Dev CLI — quick setup and testing."""

from __future__ import annotations

import argparse
import json
import sys


def cmd_setup(args: argparse.Namespace) -> None:
    """Interactive setup — store API keys in ~/.browseaidev.json."""
    import os

    config_path = os.path.expanduser("~/.browseaidev.json")

    print()
    print("  browseaidev setup")
    print("  =================")
    print("  Configure the BrowseAI Dev Python SDK\n")

    api_key = input("  BrowseAI Dev API key (get a free one at https://browseai.dev/dashboard): ").strip()

    if not api_key:
        print("\n  API key is required. Sign up at https://browseai.dev to get a free key.\n")
        sys.exit(1)

    config: dict[str, str] = {"api_key": api_key}

    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)
    os.chmod(config_path, 0o600)

    print(f"""
  Done! Config saved to {config_path}

  Quick start:

    from browseaidev import BrowseAIDev

    client = BrowseAIDev.from_config()
    result = client.ask("What is quantum computing?")
    print(result.answer)

  Or test it now:

    browseaidev ask "What is quantum computing?"
""")


def cmd_ask(args: argparse.Namespace) -> None:
    """Run a query via the CLI."""
    from .client import BrowseAIDev

    client = BrowseAIDev.from_config()
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
    from .client import BrowseAIDev

    client = BrowseAIDev.from_config()
    results = client.search(args.query, limit=args.limit)

    print(f"\n  Results ({len(results)}):\n")
    for i, r in enumerate(results, 1):
        print(f"  {i}. {r.title}")
        print(f"     {r.url}")
        print(f"     {r.snippet[:120]}...")
        print()

    client.close()


def cmd_version(args: argparse.Namespace) -> None:
    from . import __version__
    print(f"browseaidev {__version__}")


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="browseaidev",
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
