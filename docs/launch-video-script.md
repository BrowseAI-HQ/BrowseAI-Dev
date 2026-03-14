# BrowseAI Dev — 30s Launch Video Script

## Story Arc

```
Hallucination -> Confidently wrong -> Trust lost -> BrowseAI Dev -> Every agent verified -> Install
```

## Audience Emotion

1. "Oh no, I've been there" (0-8s)
2. "Wait, what's this?" (8-11s)
3. "It works with everything I use" (11-23s)
4. "I can install this right now" (23-30s)

---

## Beat 1: Agents Hallucinate (0-3s)

**Visual:** AI agent answers a question with 3 citation links. Links flash red one by one — fake URLs, papers that don't exist.

**Text:** `Your AI agent just made this up.`

**Audio:** Soft typing sounds, then a warning buzz as each link turns red.

---

## Beat 2: Confidently Wrong, Everywhere (3-6s)

**Visual:** Quick 1-second flashes:
1. Customer-facing chatbot confidently recommends a wrong drug interaction. User trusts it.
2. Research agent cites a paper with a real-sounding title and DOI — it doesn't exist.
3. Code agent uses a deprecated API endpoint. Build passes. Ships. Breaks.

Each looks polished and professional. The agents aren't glitching — they're *confidently wrong*.

**Text:** `Confident. Authoritative. Wrong.`

**Audio:** Ironic success "dings" on each wrong answer.

---

## Beat 3: Trust Lost (6-8s)

**Visual:** Developer manually googling to verify AI output. Sprint board tickets moving back to "To Do." Slack message: "We can't trust the AI output anymore."

**Text:** `Hours lost. Trust broken.`

**Audio:** Low tension drone.

---

## Beat 4: The Shift (8-11s)

**Visual:** Hard cut. Black. Silence. BrowseAI Dev logo fades in with a quiet green glow. Tagline types in below: "Reliable Research Infrastructure for AI Agents."

**Text:** `What if every agent could verify first?`

**Audio:** Silence, then a single clean tone.

---

## Beat 5: Every Agent Gets Superpowers (11-23s)

**Visual:** Grid of agent icons — Claude, Cursor, Codex, Copilot, LangChain, CrewAI — all grey. One by one, each lights up green (~2s per agent). As each activates, a primary feature label pulses beside it, then a secondary feature flashes briefly (0.3s):

| Agent | Primary Feature | Secondary Feature |
|-------|----------------|-------------------|
| Claude | `Evidence-backed answers` | `Source verification` |
| Cursor | `7-factor confidence scoring` | `Domain authority (10K+ domains)` |
| Codex | `Claim extraction` | `BM25 sentence matching` |
| Copilot | `Contradiction detection` | `Cross-source consensus` |
| LangChain | `Thorough mode auto-retry` | `Smart caching` |
| CrewAI | `Research sessions` | `Knowledge sharing & forking` |

All agents glowing green — a constellation of powered-up agents.

**Text:** `Every agent. Verified research. Real sources.`

**Audio:** Ascending notes per agent, resolving to a chord when all lit.

---

## Beat 6: CTA (23-30s)

**Visual:** Constellation shrinks to background. Terminal foreground, three lines type in rapid cascade with feature badges:

```
$ npx browse-ai setup                              MCP · works with 42+ agents
$ pip install browseai                              Python SDK · async + sync
$ npx skills add BrowseAI-HQ/browseAIDev_Skills     Skills · 4 ready-made workflows
```

Agent icons fade in below in a row. GitHub stars counter animates up. Final frame holds.

**Text:** `Give every agent research superpowers.`

**Subtext:** `browseai.dev · Open Source · MIT`

**Audio:** Keyboard clicks per line, clean chime on final frame.

---

## Beat Sheet Summary

| Time | Beat | Text Overlay | Features Shown |
|------|------|-------------|----------------|
| 0-3s | Agents hallucinate | Your AI agent just made this up. | — |
| 3-6s | Confidently wrong everywhere | Confident. Authoritative. Wrong. | — |
| 6-8s | Trust lost, rework | Hours lost. Trust broken. | — |
| 8-11s | BrowseAI Dev logo + tagline | What if every agent could verify first? | — |
| 11-23s | Agents light up with features | Every agent. Verified research. Real sources. | 12 features (6 primary + 6 secondary) |
| 23-30s | Install commands + CTA | Give every agent research superpowers. | MCP (42+ agents), Python SDK, Skills (4 workflows) |

---

## Production Notes

- **Total features shown:** 15 (12 in Beat 5 grid + 3 install surfaces in Beat 6)
- **Pacing:** Beats 1-4 are fast cuts (problem setup). Beat 5 slows down to let each feature register. Beat 6 is actionable.
- **Color palette:** Red/orange for problem beats (1-3), black for transition (4), green for solution beats (5-6)
- **Key difference from 20s version:** Extra 10s allows each agent in Beat 5 to hold for ~2s instead of ~1s, letting both primary and secondary features register. Beat 4 gets room for the tagline. Beat 6 gets feature badges on install lines.
