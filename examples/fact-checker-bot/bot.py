"""
Fact-Checker Bot — A Discord bot powered by BrowseAI.

Verifies claims with evidence-backed research, shows confidence scores,
sources, and contradictions.

Commands:
    !verify <claim>   — Verify a claim using thorough research
    !fact <claim>     — Alias for !verify
    !compare <claim>  — Show raw LLM vs evidence-backed side by side
"""

import os

import discord
from browseaidev import AsyncBrowseAIDev
from dotenv import load_dotenv

load_dotenv()

# ── Configuration ──────────────────────────────────────────────────────────────

DISCORD_TOKEN = os.environ["DISCORD_BOT_TOKEN"]

BROWSEAI_API_KEY = os.environ.get("BROWSEAI_API_KEY", "bai_xxx")

# ── Discord client setup ──────────────────────────────────────────────────────

intents = discord.Intents.default()
intents.message_content = True
bot = discord.Client(intents=intents)

browse = AsyncBrowseAIDev(api_key=BROWSEAI_API_KEY, timeout=120.0)


# ── Helpers ────────────────────────────────────────────────────────────────────

def confidence_indicator(score: float) -> str:
    """Return an emoji + label for the confidence score."""
    pct = round(score * 100)
    if pct >= 80:
        return f"\U0001f7e2 High Confidence ({pct}%)"    # green circle
    elif pct >= 50:
        return f"\U0001f7e1 Medium Confidence ({pct}%)"  # yellow circle
    else:
        return f"\U0001f534 Low Confidence ({pct}%)"     # red circle


def confidence_color(score: float) -> int:
    """Return a Discord embed color based on confidence."""
    if score >= 0.8:
        return 0x2ECC71  # green
    elif score >= 0.5:
        return 0xF1C40F  # yellow
    else:
        return 0xE74C3C  # red


def truncate(text: str, limit: int = 1024) -> str:
    """Truncate text to fit Discord embed field limits."""
    if len(text) <= limit:
        return text
    return text[: limit - 3] + "..."


# ── Verify command ─────────────────────────────────────────────────────────────

async def handle_verify(message: discord.Message, claim: str) -> None:
    """Verify a claim using BrowseAI thorough mode and return a formatted embed."""
    async with message.channel.typing():
        try:
            result = await browse.ask(claim, depth="thorough")
        except Exception as exc:
            await message.reply(f"\u274c **Error:** {exc}")
            return

    # Build the embed
    embed = discord.Embed(
        title="\U0001f50d Fact Check Result",
        description=truncate(result.answer, 2048),
        color=confidence_color(result.confidence),
    )

    # Verdict field
    embed.add_field(
        name="\U0001f3af Verdict",
        value=confidence_indicator(result.confidence),
        inline=False,
    )

    # Verified claims breakdown
    if result.claims:
        verified = sum(1 for c in result.claims if c.verified)
        total = len(result.claims)
        claims_text = f"{verified}/{total} claims verified\n"
        for c in result.claims[:5]:
            icon = "\u2705" if c.verified else "\u274c"
            consensus = ""
            if c.consensus_level:
                consensus = f" [{c.consensus_level}]"
            claims_text += f"{icon} {truncate(c.claim, 120)}{consensus}\n"
        if total > 5:
            claims_text += f"_...and {total - 5} more_\n"
        embed.add_field(
            name=f"\U0001f4cb Claims ({verified}/{total} verified)",
            value=truncate(claims_text),
            inline=False,
        )

    # Top sources
    if result.sources:
        sources_text = ""
        for s in result.sources[:5]:
            sources_text += f"\u2022 [{s.title}]({s.url}) ({s.domain})\n"
        embed.add_field(
            name=f"\U0001f4da Sources ({len(result.sources)} total)",
            value=truncate(sources_text),
            inline=False,
        )

    # Contradictions (if any)
    if result.contradictions:
        contra_text = ""
        for c in result.contradictions[:3]:
            contra_text += (
                f"\u26a0\ufe0f **{c.topic}**\n"
                f"> A: {truncate(c.claim_a, 100)}\n"
                f"> B: {truncate(c.claim_b, 100)}\n\n"
            )
        embed.add_field(
            name=f"\u26a0\ufe0f Contradictions ({len(result.contradictions)})",
            value=truncate(contra_text),
            inline=False,
        )

    # Footer with share link
    footer_text = "Powered by BrowseAI | browseai.dev"
    if result.share_id:
        footer_text += f" | Share: browseai.dev/share/{result.share_id}"
    embed.set_footer(text=footer_text)

    await message.reply(embed=embed)


# ── Compare command ────────────────────────────────────────────────────────────

async def handle_compare(message: discord.Message, claim: str) -> None:
    """Compare raw LLM answer vs evidence-backed answer side by side."""
    async with message.channel.typing():
        try:
            result = await browse.compare(claim)
        except Exception as exc:
            await message.reply(f"\u274c **Error:** {exc}")
            return

    raw = result.raw_llm
    ev = result.evidence_backed

    embed = discord.Embed(
        title="\u2696\ufe0f Raw LLM vs Evidence-Backed",
        description=f"**Query:** {result.query}",
        color=0x5865F2,  # Discord blurple
    )

    # Raw LLM side
    raw_conf = f"{round(raw.confidence * 100)}%" if raw.confidence else "N/A"
    embed.add_field(
        name="\U0001f916 Raw LLM",
        value=(
            f"{truncate(raw.answer, 400)}\n\n"
            f"Confidence: **{raw_conf}** (self-assessed)\n"
            f"Sources: {raw.sources} | Claims: {raw.claims}"
        ),
        inline=False,
    )

    # Evidence-backed side
    ev_pct = round(ev.confidence * 100)
    embed.add_field(
        name="\U0001f9ea Evidence-Backed",
        value=(
            f"{truncate(ev.answer, 400)}\n\n"
            f"Confidence: **{confidence_indicator(ev.confidence)}**\n"
            f"Sources: {ev.sources} | Claims: {ev.claims}"
        ),
        inline=False,
    )

    # Top citations from evidence-backed
    if ev.citations:
        cites = ""
        for s in ev.citations[:3]:
            cites += f"\u2022 [{s.title}]({s.url})\n"
        embed.add_field(
            name="\U0001f4ce Citations",
            value=cites,
            inline=False,
        )

    embed.set_footer(text="Powered by BrowseAI | browseai.dev")
    await message.reply(embed=embed)


# ── Event handlers ─────────────────────────────────────────────────────────────

@bot.event
async def on_ready():
    print(f"Fact-Checker Bot is online as {bot.user}")
    print(f"Invite: https://discord.com/oauth2/authorize?client_id={bot.user.id}&permissions=274877958144&scope=bot")


@bot.event
async def on_message(message: discord.Message):
    # Ignore messages from the bot itself
    if message.author == bot.user:
        return

    content = message.content.strip()

    # !verify or !fact — verify a claim
    if content.lower().startswith("!verify ") or content.lower().startswith("!fact "):
        claim = content.split(" ", 1)[1].strip()
        if not claim:
            await message.reply("Please provide a claim to verify. Example: `!verify The Great Wall of China is visible from space`")
            return
        await handle_verify(message, claim)

    # !compare — raw LLM vs evidence-backed
    elif content.lower().startswith("!compare "):
        claim = content.split(" ", 1)[1].strip()
        if not claim:
            await message.reply("Please provide a claim to compare. Example: `!compare Coffee is bad for your health`")
            return
        await handle_compare(message, claim)


# ── Run ────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    bot.run(DISCORD_TOKEN)
