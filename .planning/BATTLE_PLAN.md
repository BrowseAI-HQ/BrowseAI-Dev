# BrowseAI Dev — Battle Plan
*"AI agents hallucinate facts. BrowseAI Dev verifies them."*

Generated 2026-03-16 from deep research across 5 domains.

---

## THE MOAT (Why We Win)

No competitor does what we do. Verified across all 8 major competitors:

| Capability | BrowseAI Dev | Perplexity | Tavily | Exa | Google Vertex | Everyone Else |
|---|---|---|---|---|---|---|
| Claim Verification (BM25+NLI) | YES | No | No | No | Partial | No |
| Evidence-Based Confidence | YES (8-factor) | No | No | No | Regressing | No |
| Cross-Source Consensus | YES | No | No | No | No | No |
| Contradiction Detection | YES | No | No | No | No | No |
| Atomic Claim Decomposition | YES | No | No | No | No | No |
| Domain Authority (10K+ Bayesian) | YES | No | No | No | No | No |
| MCP Server | YES | Moving away | Yes | Yes | No | Varies |
| Open Source (MIT) | YES | No | No | No | No | No |

**One-liner positioning options:**
- "The search API that fact-checks itself"
- "Tavily gives you search results. BrowseAI Dev tells you which ones are true."
- "AI agents hallucinate facts. BrowseAI Dev verifies them."

---

## PHASE 1: FOUNDATION (This Week)

### 1A. Fix UI Responsiveness (1 day)

15 concrete issues found across 5 pages. Fix patterns:

**Playground.tsx:**
- Line 341: Dropdown `sm:w-[500px]` overflows on mobile → add `max-w-[calc(100vw-2rem)]`
- Line 412: Example pills `max-w-[280px]` truncates too aggressively → `max-w-[180px] sm:max-w-[280px]`
- Lines 672/744: Code blocks `p-4` → `px-2 sm:px-4`

**Dashboard.tsx:**
- Line 211: `max-h-96` too tall on mobile → `max-h-64 sm:max-h-96`

**Results.tsx:**
- Line 136: Query text `max-w-md` wider than mobile viewport → `max-w-[120px] sm:max-w-xs md:max-w-md`
- Line 143: Container `px-6` → `px-4 sm:px-6`

**Docs.tsx:**
- Line 107: Flex layout `gap-10` wastes space below lg → `gap-0 lg:gap-10` + `flex-col lg:flex-row`
- Lines 459/509/572: Tables need visual scroll indicator on mobile
- Line 878: Footer nav `gap-6` → `gap-2 sm:gap-4 md:gap-6`

**Sessions.tsx:**
- Line 366: Input `pr-32` (128px right padding) → `pr-20 sm:pr-32`
- Line 442: Pipeline steps → `hidden sm:inline` for trace details on mobile

**Components:**
- EvidenceGraph.tsx line 128: Domain names need `truncate max-w-[150px] sm:max-w-none`
- TracePipeline.tsx line 31: `max-w-[200px]` → `max-w-[100px] sm:max-w-[200px]`
- StreamingPipeline.tsx line 326: `max-w-md` → `max-w-xs sm:max-w-md`

### 1B. Build `langchain-browseaidev` Package (2 days)

**This is the #1 highest-leverage distribution move.** Tavily got to 1M monthly downloads through LangChain integration alone.

Build a Python package `langchain-browseaidev` that wraps BrowseAI Dev API as LangChain Tools:
- `BrowseAIDevSearchTool` — maps to `browse_search`
- `BrowseAIDevAnswerTool` — maps to `browse_answer` (verified search)
- `BrowseAIDevExtractTool` — maps to `browse_extract`
- `BrowseAIDevCompareTool` — maps to `browse_compare`

Publish to PyPI. Submit to LangChain integrations page. Write example notebook.

### 1C. MCP Registry Listings (2 hours)

Get listed on all three critical registries:
1. **Official MCP Registry** (registry.modelcontextprotocol.io) — submit via publisher CLI
2. **awesome-mcp-servers** (79.6k GitHub stars) — submit via glama.ai then PR
3. **Docker MCP Catalog** — PR to github.com/docker/mcp-registry

---

## PHASE 2: BENCHMARKS (1 week)

### Primary Target: AVeriTeC

**Why:** Real-world claims, open-web evidence retrieval, maps 1:1 to our pipeline. Current SOTA is only 63%. Active shared task at FEVER Workshop (EMNLP).

**Our pipeline alignment:**
- AVeriTeC requires: retrieve web evidence → verify claims → classify (Supported/Refuted/NEI/Conflicting)
- BrowseAI Dev does: web search → BM25 sentence retrieval → NLI classification → consensus → confidence
- Our NLI model (DeBERTa-v3-base-mnli-fever-anli) was literally trained on FEVER+ANLI

**Adaptation needed:**
- Download AVeriTeC dataset (4,568 claims from 50+ fact-checking orgs)
- Map our confidence scores to AVeriTeC's 4-way labels
- Evaluate using AVeriTeC's Ev2R recall metric
- Build eval harness: `scripts/benchmark/averitec.ts`

**Score targets:**
| Score | What it means |
|---|---|
| 40-50% | Average, not publishable alone |
| 55-62% | Publishable at workshop |
| >63% | New SOTA — publishable at top venue |

### Secondary Targets

**CLIMATE-FEVER** (1,535 real climate claims, SOTA ~72% F1):
- Socially important domain, strong narrative
- Needs Wikipedia corpus retrieval instead of web

**SciFact** (1,393 scientific claims, SOTA ~76% abstract F1):
- Demonstrates cross-domain generalization
- AllenAI benchmark with active leaderboard

### Deliverable

A `/benchmarks` page on browseai.dev showing:
- BrowseAI Dev scores on AVeriTeC, CLIMATE-FEVER, SciFact
- Side-by-side comparison: "Raw Tavily results" vs "BrowseAI Dev verified" on same claims
- Expected Calibration Error (ECE) for confidence scores — novel evaluation dimension

---

## PHASE 3: COMPARISON PAGE (3 days)

Build `browseai.dev/compare` showing side-by-side results:

### Head-to-Head Queries (50-100 factual questions)
Run the same queries through:
1. **BrowseAI Dev** (full pipeline with verification)
2. **Raw Tavily** (just search results, no verification)
3. **Perplexity API** (generated answer with citations)

Measure:
- **Factual accuracy** — manually verify 100 answers against ground truth
- **Citation quality** — do cited sources actually support the claims?
- **Confidence calibration** — are confidence scores meaningful?
- **Contradiction detection** — does the system flag conflicting info?

### Comparison Table (static, on the page)

| Feature | BrowseAI Dev | Tavily | Perplexity | Exa | Brave |
|---|---|---|---|---|---|
| Price/1K queries | Free (100/day) | $8 | ~$1-15/M tokens | $5-15 | $5 |
| Claim verification | BM25+NLI hybrid | No | No | No | No |
| Confidence scores | 8-factor evidence-based | No | No | No | No |
| Consensus scoring | Cross-source | No | No | No | No |
| Contradiction detection | NLI-based | No | No | No | No |
| MCP server | 13 tools | 4 tools | Moving away | 3 tools | 6 tools |
| Python SDK | Yes | Yes | No native | Yes | No |
| Open source | MIT | No | No | No | No |
| Deep research mode | Yes (iterative) | No | No | Yes ($12/1K) | No |

---

## PHASE 4: LAUNCH (1 week)

### Pre-Launch Checklist (Days -7 to -1)
- [ ] All Phase 1-3 deliverables complete
- [ ] LangChain integration published on PyPI
- [ ] Listed on all 3 MCP registries
- [ ] 90-second demo video recorded
- [ ] GitHub README is comprehensive (this IS the landing page for HN)
- [ ] Benchmark results on /benchmarks page
- [ ] Comparison data on /compare page
- [ ] Show HN post drafted (technical, modest, link to GitHub)
- [ ] Product Hunt listing prepared (3+ screenshots, video)
- [ ] Twitter launch thread drafted (8-10 tweets)
- [ ] Reddit posts drafted for r/LocalLLaMA, r/SideProject, r/OpenSource
- [ ] 15-20 developer contacts ready to engage honestly on day 1
- [ ] Blog post: "How we built an 8-factor verification pipeline" (HN bait)

### Launch Week

**Day 1 (Tuesday, 8 AM PT): HACKER NEWS**
- Post: "Show HN: BrowseAI Dev — Open-source verified search for AI agents"
- Link to GitHub repo (not landing page)
- Stay in comments all day — go deep on architecture, be transparent
- Simultaneously post Twitter launch thread
- Goal: Front page, 100+ upvotes

**Day 2 (Wednesday, 12:01 AM PT): PRODUCT HUNT**
- Launch in "Developer Tools" category
- Share PH link on Twitter
- Cross-post to r/SideProject and r/OpenSource ("I built..." framing)
- Goal: Top 5 Product of the Day

**Day 3 (Thursday): TECHNICAL CONTENT**
- Publish verification pipeline blog post
- Share on r/LocalLLaMA and r/LangChain (technical angle)
- Post in AI/dev Discord servers (LangChain, CrewAI, Claude)
- Goal: Establish technical credibility

**Day 4 (Friday): INTEGRATIONS**
- Announce LangChain integration
- Tutorial: "Add verified search to your AI agent in 5 minutes"
- Comparison content (BrowseAI Dev vs raw search APIs)
- Goal: Framework ecosystem adoption

**Day 5-7: FOLLOW-UP**
- Launch retrospective on Dev.to / Indie Hackers
- Engage every comment, issue, mention
- Personal thank-you DMs to sharers
- Collect testimonials
- Goal: Convert launch traffic into sustained community

### Post-Launch Cadence
- Ship a visible feature every 2-3 weeks with mini-launches (Supabase model)
- One benchmark blog post per month
- One comparison/case study per month
- Target one "marquee" integration per month

---

## PHASE 5: DISTRIBUTION FLYWHEEL (Ongoing)

### Tier 1: Framework Integrations (highest ROI)
- [x] MCP server (npm: browseai-dev) — already shipped
- [ ] `langchain-browseaidev` Python package → PyPI
- [ ] `llama-index-tools-browseaidev` → PyPI (auto-gets CrewAI compat)
- [ ] AutoGen tool wrapper
- [ ] n8n / Zapier / Make nodes

### Tier 2: Open Source Companion Project
Build an open-source "fact-checking agent" or "verified research agent" that uses BrowseAI Dev as its search backend. This is the GPT Researcher playbook — the OSS project is top-of-funnel.

### Tier 3: Registries & Listings
- [ ] Official MCP Registry
- [ ] awesome-mcp-servers (79.6k stars)
- [ ] Docker MCP Catalog
- [ ] awesome-ai-agents lists
- [ ] GitHub Topics: mcp, ai-search, ai-agents, web-search-api

### Tier 4: Content & SEO
- Benchmark comparison posts (drive organic traffic)
- Technical architecture deep-dives
- Integration tutorials
- browseai.dev/versus/tavily (Exa does this)

### Tier 5: Partnerships
- Get embedded in another product (B2B2C — like Exa in Notion)
- LangChain Partner Network application
- YC/accelerator connections for credibility

---

## MARKET CONTEXT

- Tavily: $25M raised, 700K+ users, 1M monthly PyPI downloads
- Exa: $85M raised at $700M valuation
- Microsoft killed Bing Search API, hiked prices 400%
- Google caps Search API at 10K/day
- MCP ecosystem: 18,500+ servers, 8M+ monthly downloads
- awesome-mcp-servers: 79.6K GitHub stars (top discovery surface)

**The window is open but closing.** Framework integrations and registry listings are being decided now. Every month we wait, another competitor fills the slot.

---

## SUCCESS METRICS

**Week 1 post-launch:**
- 200+ GitHub stars
- 100+ Show HN upvotes
- 500+ npm downloads of browseai-dev
- 50+ PyPI downloads of browseaidev + langchain-browseaidev

**Month 1:**
- 1,000+ GitHub stars
- 50+ daily API calls
- Listed in LangChain integrations page
- Benchmark results published

**Month 3:**
- 100+ daily API calls
- 5,000+ monthly PyPI downloads
- At least 1 AVeriTeC/FEVER workshop submission
- 1 B2B2C integration (embedded in another product)

---

## WHAT TO DO TOMORROW

1. Fix UI responsiveness (all 15 issues listed above)
2. Start `langchain-browseaidev` package
3. Submit to MCP registries
4. Start AVeriTeC benchmark eval harness

The rest follows from there.
