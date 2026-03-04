

# Perfect Browsing Infrastructure for AI Agents

A real, working browsing pipeline demo — no mock data, no login required.

## Pipeline (Real Data)
1. **User enters a question** in the search input
2. **Firecrawl Search** — searches the web for relevant pages (via edge function)
3. **Firecrawl Scrape** — extracts content from top results (via edge function)
4. **Claim Extraction** — Gemini Flash parses scraped content into structured claims (via Lovable AI edge function)
5. **Evidence Graph Building** — claims are linked to their source pages
6. **Gemini Summary** — Gemini Flash produces a final structured answer with citations
7. **Return** structured JSON with `claims`, `sources`, `answer`, and `confidence`

## Pages

### Homepage
- Hero: "Browsing Infrastructure for AI Agents" with subtitle and search input
- Example prompt chips (What is a wormhole?, Why is the sky blue?, What causes inflation?)
- "Browse Knowledge" button triggers the full pipeline

### Results Page (4 sections)
1. **Final Answer** — Large card with Gemini's synthesized explanation + confidence badge
2. **Evidence Graph** — Visual node layout: Claim → Source A/B/C, each with title, domain, highlighted quote
3. **Trace Pipeline** — Real step-by-step with actual timing from each stage (search, scrape, extract, summarize)
4. **Agent JSON** — Syntax-highlighted raw JSON output

### Playground Mode
- Simulate individual tool calls: `browse.search`, `browse.extract`, `browse.answer`
- Each shows real request/response from the pipeline

## Backend (Edge Functions)
- **firecrawl-search** — Searches the web via Firecrawl connector
- **firecrawl-scrape** — Scrapes top result pages via Firecrawl connector
- **browse-knowledge** — Orchestrator: calls search → scrape → sends content to Gemini Flash for claim extraction and final answer generation

## Integrations
- **Firecrawl connector** — for real web search and page scraping
- **Lovable AI (Gemini Flash)** — for claim extraction and answer summarization (LOVABLE_API_KEY already configured)

## Design
- Monochrome palette, large bold typography, projector-optimized
- Smooth staggered animations on results
- No auth — fully public demo

