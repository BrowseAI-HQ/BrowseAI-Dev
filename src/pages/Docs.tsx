import { useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { SEO } from "@/components/SEO";
import { motion } from "framer-motion";
import {
  ArrowLeft, Search, Layers, Shield, Brain, Zap, AlertTriangle,
  BarChart3, Terminal, Code2, BookOpen, Github, Cloud, Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrowseLogo } from "@/components/BrowseLogo";

const NAV_ITEMS = [
  { id: "pipeline", label: "Pipeline", icon: Layers },
  { id: "thorough-mode", label: "Thorough Mode", icon: Zap },
  { id: "deep-mode", label: "Deep Mode", icon: Layers },
  { id: "research-sessions", label: "Research Sessions", icon: Brain },
  { id: "verification", label: "Verification", icon: Shield },
  { id: "confidence", label: "Confidence Score", icon: BarChart3 },
  { id: "domain-authority", label: "Domain Authority", icon: Brain },
  { id: "contradictions", label: "Contradictions", icon: AlertTriangle },
  { id: "api", label: "API Reference", icon: Code2 },
  { id: "hosted-vs-self", label: "Hosted vs Self-Host", icon: Cloud },
  { id: "query-tips", label: "Query Tips", icon: Search },
  { id: "faq", label: "FAQ", icon: BookOpen },
];

const Section = ({ id, title, icon: Icon, children }: { id: string; title: string; icon: any; children: React.ReactNode }) => (
  <section id={id} className="scroll-mt-24">
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-accent" />
        <h2 className="text-2xl font-bold">{title}</h2>
      </div>
      <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">{children}</div>
    </motion.div>
  </section>
);

const CodeBlock = ({ children, label }: { children: string; label?: string }) => (
  <div className="rounded-xl bg-card border border-border overflow-hidden">
    {label && (
      <div className="px-4 py-2 border-b border-border bg-secondary/50">
        <span className="text-xs font-mono text-muted-foreground">{label}</span>
      </div>
    )}
    <pre className="p-4 overflow-x-auto text-xs font-mono text-secondary-foreground leading-relaxed">{children}</pre>
  </div>
);

const Docs = () => {
  const navigate = useNavigate();
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  }, [hash]);

  return (
    <>
    <SEO
      title="Documentation — API Reference, Verification Pipeline, Confidence Scoring"
      description="Complete API docs for BrowseAI Dev. Learn about the verification pipeline, confidence scoring algorithm, thorough mode, domain authority, and how to integrate with MCP, REST API, or Python SDK."
      canonical="/docs"
      structuredData={{
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "headline": "BrowseAI Dev Documentation",
        "description": "API reference and technical documentation for BrowseAI Dev research infrastructure.",
        "url": "https://browseai.dev/docs",
        "author": { "@type": "Organization", "name": "BrowseAI Dev" },
      }}
    />
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 flex items-center justify-between px-4 sm:px-8 py-5 z-50 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <img src="/logo.svg" alt="BrowseAI Dev" className="w-5 h-5" />
            <span className="font-semibold text-sm tracking-tight">Docs</span>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={() => navigate("/playground")}>
            <Terminal className="w-4 h-4 sm:hidden" />
            <span className="hidden sm:inline">Playground</span>
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={() => navigate("/developers")}>
            <Code2 className="w-4 h-4 sm:hidden" />
            <span className="hidden sm:inline">Developers</span>
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" asChild>
            <a href="https://github.com/BrowseAI-HQ/BrowseAI-Dev" target="_blank" rel="noopener">
              <Github className="w-4 h-4 sm:hidden" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </Button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-20 flex flex-col lg:flex-row gap-0 lg:gap-10">
        {/* Sidebar */}
        <aside className="hidden lg:block w-48 shrink-0 sticky top-24 self-start">
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-16">
          {/* Hero */}
          <div>
            <Badge variant="outline" className="text-xs font-normal mb-4">Documentation</Badge>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">How BrowseAI Dev Works</h1>
            <p className="text-muted-foreground max-w-2xl leading-relaxed">
              BrowseAI Dev gives AI agents reliable web research with evidence-backed citations.
              This page explains every feature — how it works, when to use it, and how to integrate it.
            </p>
          </div>

          {/* Pipeline */}
          <Section id="pipeline" title="The Verification Pipeline" icon={Layers}>
            <p>Every query goes through a 6-step pipeline. Each step adds a layer of verification.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { step: "1. Search", desc: "Query the web via Tavily API. Returns 5-10 relevant results." },
                { step: "2. Fetch", desc: "Parse each page with Readability. Strip ads, nav, scripts — keep content." },
                { step: "3. Extract", desc: "LLM extracts structured claims with source attribution." },
                { step: "4. Verify", desc: "BM25 scores each claim against its cited source text." },
                { step: "5. Consensus", desc: "Cross-source check — claims verified against ALL pages, not just cited ones." },
                { step: "6. Answer", desc: "Generate cited answer with confidence score, claims, sources, and trace." },
              ].map((s) => (
                <div key={s.step} className="p-3 rounded-lg bg-card border border-border">
                  <span className="text-xs font-semibold text-accent">{s.step}</span>
                  <p className="text-xs text-muted-foreground mt-1">{s.desc}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Thorough Mode */}
          <Section id="thorough-mode" title="Thorough Mode" icon={Zap}>
            <p>
              By default, BrowseAI Dev runs in <strong className="text-foreground">fast mode</strong> — a single search-fetch-extract pass.
              For important queries where accuracy matters more than speed, use <strong className="text-foreground">thorough mode</strong>.
            </p>

            <div className="p-4 rounded-xl bg-accent/5 border border-accent/20">
              <h4 className="text-sm font-semibold text-foreground mb-2">How thorough mode works</h4>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Runs the normal pipeline (search, fetch, extract, verify)</li>
                <li>Checks the confidence score — if it's below 60%, triggers a retry</li>
                <li>Rephrases the query using the LLM (alternative terms, more specific phrasing)</li>
                <li>Runs a second pass with the rephrased query</li>
                <li>Merges sources from both passes</li>
                <li>Picks whichever pass produced the higher confidence result</li>
              </ol>
            </div>

            <h4 className="text-sm font-semibold text-foreground pt-2">When to use it</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Complex or niche topics where the first search might miss key sources</li>
              <li>When you need high-confidence results and can afford ~2x latency</li>
              <li>Ambiguous queries that could benefit from rephrasing</li>
            </ul>

            <h4 className="text-sm font-semibold text-foreground pt-2">Usage</h4>

            <CodeBlock label="REST API">{`curl -X POST https://browseai.dev/api/browse/answer \\
  -H "Content-Type: application/json" \\
  -H "X-Tavily-Key: tvly-xxx" \\
  -H "X-OpenRouter-Key: sk-or-xxx" \\
  -d '{"query": "What is quantum computing?", "depth": "thorough"}'`}</CodeBlock>

            <CodeBlock label="Python SDK">{`from browseaidev import BrowseAIDev

client = BrowseAIDev(api_key="bai_xxx")

# Fast (default)
result = client.ask("What is quantum computing?")

# Thorough — auto-retries if confidence < 60%
result = client.ask("What is quantum computing?", depth="thorough")`}</CodeBlock>

            <CodeBlock label="MCP (Claude Desktop)">{`Ask Claude: "Use browse_answer with depth thorough to research quantum computing"`}</CodeBlock>

            <CodeBlock label="Website">{`Toggle "Fast Mode" → "Thorough Mode" below the search bar, then search.
Or append &depth=thorough to the results URL.`}</CodeBlock>
          </Section>

          {/* Deep Mode */}
          <Section id="deep-mode" title="Deep Mode" icon={Layers}>
            <p>
              For complex research requiring comprehensive analysis, use <strong className="text-foreground">deep mode</strong>.
              Unlike thorough mode (2 passes), deep mode runs an <strong className="text-foreground">iterative agentic research loop</strong> that
              identifies knowledge gaps and fills them with targeted follow-up searches.
            </p>

            <div className="p-4 rounded-xl bg-accent/5 border border-accent/20">
              <h4 className="text-sm font-semibold text-foreground mb-2">How deep mode works</h4>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Runs the full pipeline (search, fetch, extract, verify) — same as a fast pass</li>
                <li>If confidence is below 85%, triggers <strong>gap analysis</strong> — LLM identifies what's missing</li>
                <li>Generates targeted follow-up search queries to fill those gaps</li>
                <li>Runs additional search passes for each follow-up query</li>
                <li>Merges claims and sources across all passes (deduplicating by content overlap)</li>
                <li>Re-verifies all merged claims against all page texts</li>
                <li>Repeats steps 2-6 up to 3 times or until confidence reaches 85%</li>
              </ol>
            </div>

            <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
              <h4 className="text-sm font-semibold text-foreground mb-2">Quota &amp; requirements</h4>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Deep mode costs <strong>3x</strong> a normal query against your premium quota</li>
                <li>Requires a BrowseAI API key (<code className="bg-secondary px-1 rounded">bai_xxx</code>) — not available with BYOK</li>
                <li>Falls back to thorough mode if premium quota is exceeded</li>
                <li>Latency: 10-30s depending on how many follow-up rounds are needed</li>
              </ul>
            </div>

            <h4 className="text-sm font-semibold text-foreground pt-2">When to use it</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Multi-faceted research questions with several dimensions to cover</li>
              <li>When you need the highest possible confidence and completeness</li>
              <li>Topics where a single search pass can't surface all the relevant information</li>
              <li>Agent workflows that need to minimize hallucination risk</li>
            </ul>

            <h4 className="text-sm font-semibold text-foreground pt-2">Response extras</h4>
            <p>
              Deep mode responses include a <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">reasoningSteps</code> array showing
              each research iteration — the query used, gaps identified, claim count, and running confidence.
              This gives full transparency into the agent's research process.
            </p>

            <h4 className="text-sm font-semibold text-foreground pt-2">Usage</h4>

            <CodeBlock label="REST API">{`curl -X POST https://browseai.dev/api/browse/answer \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer bai_xxx" \\
  -d '{"query": "Compare RISC-V vs ARM for edge AI inference", "depth": "deep"}'`}</CodeBlock>

            <CodeBlock label="Python SDK">{`from browseaidev import BrowseAIDev

client = BrowseAIDev(api_key="bai_xxx")

# Deep — iterative research with gap analysis
result = client.ask(
    "Compare RISC-V vs ARM for edge AI inference",
    depth="deep"
)

# See the reasoning steps
for step in result.reasoning_steps:
    print(f"Step {step['step']}: {step['query']} → {step['confidence']:.0%}")`}</CodeBlock>

            <CodeBlock label="MCP (Claude Desktop)">{`Ask Claude: "Use browse_answer with depth deep to compare RISC-V vs ARM for edge AI"`}</CodeBlock>

            <CodeBlock label="Streaming (SSE)">{`curl -N -X POST https://browseai.dev/api/browse/answer/stream \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer bai_xxx" \\
  -d '{"query": "Compare RISC-V vs ARM for edge AI", "depth": "deep"}'

# Emits reasoning_step events as research progresses:
# event: reasoning_step
# data: {"step":1,"query":"Compare RISC-V vs ARM...","confidence":0.62}
# event: reasoning_step
# data: {"step":2,"query":"RISC-V edge AI benchmarks","confidence":0.78}`}</CodeBlock>
          </Section>

          {/* Research Sessions */}
          <Section id="research-sessions" title="Research Sessions (Memory)" icon={Brain}>
            <p>
              Persistent research sessions that accumulate knowledge across multiple queries.
              Each session stores verified claims and automatically <strong className="text-foreground">recalls prior findings</strong> when
              you ask follow-up questions — building deeper understanding over time.
            </p>

            <div className="p-4 rounded-xl bg-accent/5 border border-accent/20">
              <h4 className="text-sm font-semibold text-foreground mb-2">How sessions work</h4>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Create a named session (e.g., "quantum-research")</li>
                <li>Ask questions within the session — each query goes through the full verification pipeline</li>
                <li>Verified claims are automatically stored in the session knowledge base</li>
                <li>Future queries recall relevant prior claims before searching — providing context</li>
                <li>Vague follow-ups like "How does this work?" are automatically contextualized using session knowledge</li>
              </ol>
            </div>

            <h4 className="text-sm font-semibold text-foreground pt-2">Query contextualization</h4>
            <p>
              When you ask a short or vague question (e.g., "How does this work?", "Tell me more"),
              the system detects it's ambiguous and prepends context from the session name and top recalled claims.
              This ensures searches are always topic-relevant, even for pronouns and references.
            </p>

            <h4 className="text-sm font-semibold text-foreground pt-2">Usage</h4>

            <CodeBlock label="Python SDK">{`from browseaidev import BrowseAIDev

client = BrowseAIDev(api_key="bai_xxx")

# Create a session
session = client.session("quantum-research")

# First query — 13 claims stored
r1 = session.ask("What is quantum entanglement?")
print(f"New claims: {r1.session.new_claims_stored}")

# Follow-up — recalls prior claims automatically
r2 = session.ask("How is entanglement used in computing?")
print(f"Recalled: {r2.session.recalled_claims}")

# Export all accumulated knowledge
knowledge = session.knowledge()`}</CodeBlock>

            <CodeBlock label="REST API">{`# Create session
curl -X POST https://browseai.dev/api/session \\
  -H "Authorization: Bearer bai_xxx" \\
  -d '{"name": "quantum-research"}'
# Returns: { "success": true, "result": { "id": "abc123", "name": "quantum-research" } }

# Ask within session
curl -X POST https://browseai.dev/api/session/abc123/ask \\
  -H "Authorization: Bearer bai_xxx" \\
  -d '{"query": "What is quantum entanglement?"}'

# Recall without new search
curl -X POST https://browseai.dev/api/session/abc123/recall \\
  -d '{"query": "entanglement"}'

# Export knowledge
curl https://browseai.dev/api/session/abc123/knowledge`}</CodeBlock>

            <CodeBlock label="MCP (Claude Desktop)">{`Ask Claude: "Create a research session called quantum-research"
Then: "In the quantum-research session, what is quantum entanglement?"
Then: "How is entanglement used in computing?" — prior findings are recalled automatically`}</CodeBlock>

            <h4 className="text-sm font-semibold text-foreground pt-2">Response fields</h4>
            <CodeBlock label="Session ask response">{`{
  "answer": "...",
  "confidence": 0.85,
  "session": {
    "id": "abc123",
    "name": "quantum-research",
    "recalledClaims": 5,    // prior findings recalled for this query
    "newClaimsStored": 8    // new claims added to session knowledge
  }
}`}</CodeBlock>

            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <h4 className="text-sm font-semibold text-foreground mb-1">API key required</h4>
              <p className="text-xs">
                Sessions require a BrowseAI Dev API key (<code className="bg-secondary px-1 rounded">bai_xxx</code>) for identity and ownership.
                BYOK (Tavily + OpenRouter keys only) works for search/answer but cannot use sessions.
                Get a free key at <a href="https://browseai.dev/dashboard" className="text-accent hover:underline">browseai.dev/dashboard</a>.
                For MCP, set <code className="bg-secondary px-1 rounded">BROWSE_API_KEY</code> env var.
                For Python SDK, pass <code className="bg-secondary px-1 rounded">api_key="bai_xxx"</code>.
                For REST API, use <code className="bg-secondary px-1 rounded">Authorization: Bearer bai_xxx</code>.
              </p>
            </div>

            <h4 className="text-sm font-semibold text-foreground pt-2">Sharing & Forking</h4>
            <p>
              Sessions can be shared publicly and forked by other agents or humans.
              One agent builds up research, shares the link, another agent forks it and continues — enabling <strong className="text-foreground">collaborative, multi-agent research</strong>.
            </p>

            <CodeBlock label="Python SDK">{`# Share a session
share = session.share()
print(share.url)  # https://browseai.dev/session/share/abc123def456

# Another agent forks and continues
forked = client.fork_session(share.share_id)
forked_session = client.session(forked.session.name)
forked_session.ask("What about dark energy?")`}</CodeBlock>

            <CodeBlock label="REST API">{`# Share
curl -X POST https://browseai.dev/api/session/abc123/share \\
  -H "Authorization: Bearer bai_xxx"
# Returns: { "shareId": "abc123def456" }

# View shared session (public, no auth)
curl https://browseai.dev/api/session/share/abc123def456

# Fork into your account
curl -X POST https://browseai.dev/api/session/share/abc123def456/fork \\
  -H "Authorization: Bearer bai_xxx"`}</CodeBlock>

            <CodeBlock label="MCP">{`Ask Claude: "Share my quantum-research session"
→ Returns a share URL

Another agent: "Fork the shared session abc123def456"
→ Creates a copy with all knowledge, ready to continue`}</CodeBlock>
          </Section>

          {/* Verification */}
          <Section id="verification" title="Claim Verification" icon={Shield}>
            <p>
              After the LLM extracts claims, each one is verified against the actual source page text.
              This catches hallucinated claims that have no basis in the cited sources.
            </p>

            <h4 className="text-sm font-semibold text-foreground">BM25 sentence matching</h4>
            <p>
              Each claim is tokenized and scored against every sentence in its cited sources using
              the <a href="https://en.wikipedia.org/wiki/Okapi_BM25" className="text-accent hover:underline" target="_blank" rel="noopener">BM25 algorithm</a> — the
              same ranking function behind Elasticsearch and Lucene. This catches paraphrased claims that simple keyword overlap would miss.
            </p>

            <h4 className="text-sm font-semibold text-foreground">Source quote verification</h4>
            <p>
              LLM-extracted quotes are verified against actual page text using hybrid matching:
              first tries exact substring match, then falls back to BM25 scoring.
              Sources get a <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">verified: true</code> flag when their quote is found.
            </p>

            <h4 className="text-sm font-semibold text-foreground">Cross-source consensus</h4>
            <p>
              Each claim is verified against <em>all</em> available page texts, not just its cited sources.
              A claim found in 3+ independent domains gets <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">consensusLevel: "strong"</code>.
              Single-source claims are flagged as <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">"weak"</code>.
            </p>

            <h4 className="text-sm font-semibold text-foreground">Response fields</h4>
            <CodeBlock label="Claim object">{`{
  "claim": "Aurora borealis is caused by solar wind particles...",
  "sources": ["https://nasa.gov/..."],
  "verified": true,
  "verificationScore": 0.82,
  "consensusCount": 3,
  "consensusLevel": "strong"
}`}</CodeBlock>
          </Section>

          {/* Confidence */}
          <Section id="confidence" title="7-Factor Confidence Score" icon={BarChart3}>
            <p>
              Confidence scores are <strong className="text-foreground">evidence-based</strong>, not LLM self-assessed.
              The score is computed from 7 real signals after verification:
            </p>

            <div className="overflow-x-auto [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] sm:[mask-image:none]">
              <table className="w-full text-xs min-w-[400px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">Factor</th>
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">Weight</th>
                    <th className="text-left py-2 font-semibold text-foreground">What it measures</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  <tr><td className="py-2 pr-4">Verification rate</td><td className="py-2 pr-4 text-accent font-mono">25%</td><td className="py-2">% of claims verified in actual source text</td></tr>
                  <tr><td className="py-2 pr-4">Domain authority</td><td className="py-2 pr-4 text-accent font-mono">20%</td><td className="py-2">Avg trustworthiness of source domains</td></tr>
                  <tr><td className="py-2 pr-4">Source count</td><td className="py-2 pr-4 text-accent font-mono">15%</td><td className="py-2">More sources = more corroboration (log curve)</td></tr>
                  <tr><td className="py-2 pr-4">Consensus</td><td className="py-2 pr-4 text-accent font-mono">15%</td><td className="py-2">Cross-source agreement across independent domains</td></tr>
                  <tr><td className="py-2 pr-4">Domain diversity</td><td className="py-2 pr-4 text-accent font-mono">10%</td><td className="py-2">Unique domains / total sources</td></tr>
                  <tr><td className="py-2 pr-4">Claim grounding</td><td className="py-2 pr-4 text-accent font-mono">10%</td><td className="py-2">% of claims citing at least one source</td></tr>
                  <tr><td className="py-2 pr-4">Citation depth</td><td className="py-2 pr-4 text-accent font-mono">5%</td><td className="py-2">Avg sources per claim (capped at 3)</td></tr>
                </tbody>
              </table>
            </div>

            <p>
              <strong className="text-foreground">Contradiction penalty:</strong> Each detected contradiction subtracts 0.05 from the raw score.
              Final range: <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">0.10</code> (unverified, unknown sources)
              to <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">0.97</code> (verified, multi-source consensus from authoritative domains).
            </p>

            <h4 className="text-sm font-semibold text-foreground">How to interpret scores</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { range: "0.80+", label: "High", color: "text-emerald-400", desc: "Well-verified, multiple authoritative sources" },
                { range: "0.60-0.79", label: "Moderate", color: "text-amber-400", desc: "Partially verified, decent sources" },
                { range: "0.40-0.59", label: "Low", color: "text-orange-400", desc: "Weak verification or few sources" },
                { range: "< 0.40", label: "Very Low", color: "text-red-400", desc: "Unverified or unreliable sources" },
              ].map((s) => (
                <div key={s.range} className="p-3 rounded-lg bg-card border border-border">
                  <span className={`text-xs font-mono font-bold ${s.color}`}>{s.range}</span>
                  <p className="text-xs font-semibold text-foreground mt-1">{s.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Domain Authority */}
          <Section id="domain-authority" title="Domain Authority" icon={Brain}>
            <p>
              10,000+ domains are classified into 5 tiers of trustworthiness, loaded from a database seeded with curated domains and Majestic Million rankings. Scores self-improve over time via Bayesian smoothing. Unknown domains get a neutral score (0.50).
            </p>

            <div className="overflow-x-auto [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] sm:[mask-image:none]">
              <table className="w-full text-xs min-w-[400px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">Tier</th>
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">Score</th>
                    <th className="text-left py-2 font-semibold text-foreground">Examples</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  <tr><td className="py-2 pr-4">Institutional</td><td className="py-2 pr-4 font-mono">0.95</td><td className="py-2">.gov, .edu, WHO, CDC, Nature</td></tr>
                  <tr><td className="py-2 pr-4">Major news</td><td className="py-2 pr-4 font-mono">0.80</td><td className="py-2">Reuters, AP, BBC, NYT</td></tr>
                  <tr><td className="py-2 pr-4">Tech / reference</td><td className="py-2 pr-4 font-mono">0.70</td><td className="py-2">Wikipedia, MDN, Stack Overflow</td></tr>
                  <tr><td className="py-2 pr-4">Community</td><td className="py-2 pr-4 font-mono">0.50</td><td className="py-2">Medium, Reddit, dev blogs</td></tr>
                  <tr><td className="py-2 pr-4">Low quality</td><td className="py-2 pr-4 font-mono">0.20</td><td className="py-2">Content farms, SEO spam</td></tr>
                </tbody>
              </table>
            </div>

            <h4 className="text-sm font-semibold text-foreground pt-2">Self-improving scores</h4>
            <p>
              Domain authority scores <strong className="text-foreground">improve automatically over time</strong>.
              Every query feeds verification data back into the system. We use Bayesian cold-start smoothing to blend
              static tier scores with real verification rates:
            </p>
            <CodeBlock label="Formula">{`blended = (static_score * PRIOR_WEIGHT + dynamic_score * sample_count) / (PRIOR_WEIGHT + sample_count)

PRIOR_WEIGHT = 15  (static scores dominate until ~15+ samples)
Minimum 3 samples before dynamic data is used at all`}</CodeBlock>
            <p>
              This means static tier scores are trusted initially. As evidence accumulates for a domain,
              its real verification rate gradually takes over. The more your agents use BrowseAI Dev, the more
              accurate future results become.
            </p>
          </Section>

          {/* Contradictions */}
          <Section id="contradictions" title="Contradiction Detection" icon={AlertTriangle}>
            <p>
              Claim pairs are analyzed for semantic conflicts using topic overlap and negation asymmetry.
              When two claims discuss the same topic but assert opposite things, a contradiction is flagged.
            </p>

            <CodeBlock label="Contradiction in response">{`{
  "contradictions": [
    {
      "claimA": "Python is the fastest growing programming language",
      "claimB": "JavaScript remains the most rapidly adopted language",
      "topic": "programming language growth"
    }
  ]
}`}</CodeBlock>

            <p>
              Each contradiction <strong className="text-foreground">penalizes the confidence score by 0.05</strong>.
              Agents can use the <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">contradictions</code> field
              to flag uncertainty or ask for clarification instead of choosing between conflicting claims.
            </p>
          </Section>

          {/* API Reference */}
          <Section id="api" title="API Reference" icon={Code2}>
            <h4 className="text-sm font-semibold text-foreground">REST API</h4>
            <div className="overflow-x-auto [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] sm:[mask-image:none]">
              <table className="w-full text-xs min-w-[400px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">Endpoint</th>
                    <th className="text-left py-2 font-semibold text-foreground">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  <tr><td className="py-2 pr-4 font-mono text-accent">POST /browse/search</td><td className="py-2">Search the web</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-accent">POST /browse/open</td><td className="py-2">Fetch and parse a page</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-accent">POST /browse/extract</td><td className="py-2">Extract structured claims from a page</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-accent">POST /browse/answer</td><td className="py-2">Full pipeline with citations. Accepts <code className="bg-secondary px-1 rounded">depth: "fast" | "thorough" | "deep"</code></td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-accent">POST /browse/compare</td><td className="py-2">Compare raw LLM vs evidence-backed answer</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-accent">POST /browse/answer/stream</td><td className="py-2">Streaming answer via SSE — real-time progress events</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-accent">POST /session</td><td className="py-2">Create a research session</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-accent">POST /session/:id/ask</td><td className="py-2">Research with session memory (recalls + stores claims)</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-accent">POST /session/:id/recall</td><td className="py-2">Query session knowledge without new search</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-accent">GET /session/:id/knowledge</td><td className="py-2">Export all session claims</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-accent">POST /session/:id/share</td><td className="py-2">Share a session publicly (returns shareId)</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-accent">GET /session/share/:shareId</td><td className="py-2">View a shared session (public, no auth)</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-accent">POST /session/share/:shareId/fork</td><td className="py-2">Fork a shared session into your account</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-accent">GET /session/:id</td><td className="py-2">Get session details</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-accent">GET /sessions</td><td className="py-2">List your sessions (authenticated)</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-accent">DELETE /session/:id</td><td className="py-2">Delete a session (authenticated)</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-accent">GET /browse/share/:id</td><td className="py-2">Get a shared result</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-accent">GET /browse/stats</td><td className="py-2">Total queries answered</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-accent">GET /browse/sources/top</td><td className="py-2">Top cited source domains</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-accent">GET /user/stats</td><td className="py-2">Your query stats (authenticated)</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-accent">GET /user/history</td><td className="py-2">Your query history (authenticated)</td></tr>
                  <tr><td className="py-2 pr-4 font-mono text-accent">POST /browse/feedback</td><td className="py-2">Submit feedback on a result (good/bad/wrong)</td></tr>
                </tbody>
              </table>
            </div>

            <h4 className="text-sm font-semibold text-foreground pt-4">Python SDK</h4>
            <CodeBlock label="pip install browseaidev">{`from browseaidev import BrowseAIDev

client = BrowseAIDev(api_key="bai_xxx")

# Full pipeline
result = client.ask("What is quantum computing?")
result = client.ask("What is quantum computing?", depth="thorough")
result = client.ask("What is quantum computing?", depth="deep")

# Individual tools
results = client.search("AI news", limit=5)
page = client.open("https://example.com")
extract = client.extract("https://example.com", query="pricing")
compare = client.compare("Is Python faster than Rust?")

# Research sessions
session = client.session("my-research")
r = session.ask("What is quantum computing?")
knowledge = session.knowledge()`}</CodeBlock>

            <h4 className="text-sm font-semibold text-foreground pt-4">Framework Integrations</h4>
            <CodeBlock label="pip install langchain-browseaidev">{`from langchain_browseaidev import BrowseAIDevAnswerTool

tool = BrowseAIDevAnswerTool(api_key="bai_xxx")
result = tool.invoke({"query": "What is quantum computing?", "depth": "thorough"})

# 4 tools: BrowseAIDevSearchTool, BrowseAIDevAnswerTool,
#           BrowseAIDevExtractTool, BrowseAIDevCompareTool`}</CodeBlock>
            <p>
              Also available: <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">pip install crewai-browseaidev</code>,{" "}
              <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">pip install llamaindex-browseaidev</code>
            </p>

            <h4 className="text-sm font-semibold text-foreground pt-4">MCP Server</h4>
            <CodeBlock label="Setup">{`npx browseai-dev setup`}</CodeBlock>
            <p>
              12 tools: <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">browse_search</code>,{" "}
              <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">browse_open</code>,{" "}
              <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">browse_extract</code>,{" "}
              <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">browse_answer</code>,{" "}
              <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">browse_compare</code>,{" "}
              <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">browse_feedback</code>,{" "}
              <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">browse_session_create</code>,{" "}
              <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">browse_session_ask</code>,{" "}
              <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">browse_session_recall</code>,{" "}
              <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">browse_session_share</code>,{" "}
              <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">browse_session_knowledge</code>,{" "}
              <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">browse_session_fork</code>.
              Works with Claude Desktop, Cursor, and Windsurf.
            </p>

            <h4 className="text-sm font-semibold text-foreground pt-4">Authentication</h4>
            <div className="overflow-x-auto [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] sm:[mask-image:none]">
              <table className="w-full text-xs min-w-[400px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">Method</th>
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">How</th>
                    <th className="text-left py-2 font-semibold text-foreground">Limits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  <tr><td className="py-2 pr-4">BYOK</td><td className="py-2 pr-4">Pass <code className="bg-secondary px-1 rounded">X-Tavily-Key</code> + <code className="bg-secondary px-1 rounded">X-OpenRouter-Key</code> headers</td><td className="py-2">Unlimited, free (no sessions)</td></tr>
                  <tr><td className="py-2 pr-4">API Key</td><td className="py-2 pr-4"><code className="bg-secondary px-1 rounded">Authorization: Bearer bai_xxx</code></td><td className="py-2">Unlimited + sessions</td></tr>
                  <tr><td className="py-2 pr-4">Demo</td><td className="py-2 pr-4">No auth</td><td className="py-2">5 queries/hour per IP</td></tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* Hosted vs Self-Hosted */}
          <Section id="hosted-vs-self" title="Hosted vs Self-Hosted" icon={Cloud}>
            <p>
              BrowseAI Dev is MIT-licensed and can be self-hosted. But the hosted service at{" "}
              <a href="https://browseai.dev" className="text-accent hover:underline">browseai.dev</a>{" "}
              provides advantages that can't be replicated by running your own instance:
            </p>

            <div className="overflow-x-auto [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] sm:[mask-image:none]">
              <table className="w-full text-xs min-w-[400px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">Feature</th>
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">Hosted (browseai.dev)</th>
                    <th className="text-left py-2 font-semibold text-foreground">Self-Hosted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  <tr><td className="py-2 pr-4">Domain authority</td><td className="py-2 pr-4 text-accent">Self-improving from all users' data</td><td className="py-2">Static tiers only</td></tr>
                  <tr><td className="py-2 pr-4">Cache</td><td className="py-2 pr-4 text-accent">Shared across all users — popular queries are instant</td><td className="py-2">Your queries only</td></tr>
                  <tr><td className="py-2 pr-4">Accuracy over time</td><td className="py-2 pr-4 text-accent">Gets smarter with every query</td><td className="py-2">Same accuracy forever</td></tr>
                  <tr><td className="py-2 pr-4">Updates</td><td className="py-2 pr-4 text-accent">Automatic — new algorithms, domains, features</td><td className="py-2">Manual git pull</td></tr>
                  <tr><td className="py-2 pr-4">Infrastructure</td><td className="py-2 pr-4 text-accent">Zero ops — we handle scaling, uptime, monitoring</td><td className="py-2">You manage everything</td></tr>
                  <tr><td className="py-2 pr-4">API key management</td><td className="py-2 pr-4 text-accent">One BrowseAI Dev key bundles all services</td><td className="py-2">Manage Tavily + OpenRouter keys yourself</td></tr>
                  <tr><td className="py-2 pr-4">Pro features (coming)</td><td className="py-2 pr-4 text-accent">Multi-model verification, priority queue, 15+ sources</td><td className="py-2">Not available</td></tr>
                </tbody>
              </table>
            </div>

            <div className="p-4 rounded-xl bg-accent/5 border border-accent/20">
              <h4 className="text-sm font-semibold text-foreground mb-2">The data flywheel</h4>
              <p className="text-xs">
                The hosted service aggregates anonymized verification signals from thousands of queries across all users.
                When a domain consistently produces verified claims, its authority score rises. When it doesn't, the score drops.
                This creates a compounding accuracy advantage that no single self-hosted instance can match — because accuracy
                scales with collective usage, not individual deployment.
              </p>
            </div>

            <p>
              Self-hosting is great for air-gapped environments, compliance requirements, or experimentation.
              For production agent pipelines where accuracy matters, the hosted service delivers meaningfully better results
              and keeps improving automatically.
            </p>
          </Section>

          {/* Query Tips */}
          <Section id="query-tips" title="Query Tips" icon={Search}>
            <p>
              BrowseAI Dev classifies queries into types and optimizes each differently.
              Here's how to get the best results for each type:
            </p>

            {[
              {
                type: "Factual",
                desc: "Direct questions with verifiable answers. These get the highest confidence scores because claims can be cross-verified across multiple sources.",
                good: [
                  "What is the current population of Tokyo?",
                  "When was the transistor invented?",
                  "What is the melting point of titanium?",
                ],
                bad: [
                  "Tell me about Tokyo",
                  "Transistors",
                ],
                tip: "Be specific. Ask for concrete facts rather than broad overviews.",
              },
              {
                type: "How-to / Explanatory",
                desc: "Questions about mechanisms, processes, or procedures. Works best when the query targets a specific mechanism.",
                good: [
                  "How does mRNA vaccine technology work at the molecular level?",
                  "How does retrieval-augmented generation (RAG) improve LLM accuracy?",
                  "How do carbon capture and storage technologies work?",
                ],
                bad: [
                  "Explain vaccines",
                  "What is RAG?",
                ],
                tip: "Include the specific mechanism or process you want explained. \"How does X work\" outperforms \"What is X\".",
              },
              {
                type: "Comparison",
                desc: "Comparing two or more things. Use the /compare endpoint for side-by-side raw LLM vs evidence-backed results.",
                good: [
                  "How does solar energy compare to wind energy in cost and efficiency?",
                  "What are the key differences between PostgreSQL and MySQL for modern applications?",
                  "Kubernetes vs Docker Swarm: which is better for container orchestration?",
                ],
                bad: [
                  "Solar vs wind",
                  "Best database",
                ],
                tip: "Name both things explicitly and specify the comparison dimension (cost, performance, safety, etc.).",
              },
              {
                type: "Time-sensitive",
                desc: "Questions about current events or recent developments. These get shorter cache TTLs to stay fresh.",
                good: [
                  "What are the latest findings from the James Webb Space Telescope?",
                  "What is the current state of the global semiconductor supply chain?",
                  "How has the AI boom affected energy consumption in data centers?",
                ],
                bad: [
                  "JWST news",
                  "Chip shortage",
                ],
                tip: "Include temporal context like \"latest\", \"current state\", or \"recent developments\".",
              },
              {
                type: "Opinion / Nuanced",
                desc: "Topics with multiple valid perspectives. BrowseAI Dev searches more sources and highlights contradictions.",
                good: [
                  "Is nuclear energy safe and should it be expanded to fight climate change?",
                  "What are the arguments for and against universal basic income?",
                  "Should AI-generated art be eligible for copyright protection?",
                ],
                bad: [
                  "Is nuclear good?",
                  "UBI opinions",
                ],
                tip: "Frame as a balanced question. BrowseAI Dev will surface contradictions and multiple viewpoints automatically.",
              },
            ].map((item) => (
              <div key={item.type} className="p-4 rounded-xl bg-card border border-border space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-foreground">{item.type}</h4>
                </div>
                <p className="text-xs">{item.desc}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-green-400 mb-1">Good queries:</p>
                    <ul className="space-y-1">
                      {item.good.map((q) => (
                        <li key={q} className="text-xs text-muted-foreground">• {q}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-red-400 mb-1">Too vague:</p>
                    <ul className="space-y-1">
                      {item.bad.map((q) => (
                        <li key={q} className="text-xs text-muted-foreground">• {q}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <p className="text-xs text-accent">Tip: {item.tip}</p>
              </div>
            ))}
          </Section>

          {/* FAQ */}
          <Section id="faq" title="FAQ" icon={BookOpen}>
            {[
              {
                q: "Why is my confidence score low (40-60%)?",
                a: "Confidence depends on real evidence signals. Common reasons for lower scores: the topic has few authoritative sources online, claims are only found in one source (weak consensus), or the sources are community-tier domains. Try thorough mode — it often improves scores by finding better sources on a rephrased query.",
              },
              {
                q: "What's the difference between fast and thorough mode?",
                a: "Fast mode runs one search-fetch-extract pass. Thorough mode does the same, then checks confidence — if below 60%, it rephrases your query and runs a second pass, merging sources from both. Thorough mode takes ~2x longer but produces higher-confidence results on complex queries.",
              },
              {
                q: "How does BrowseAI Dev differ from Perplexity?",
                a: "Perplexity is a consumer search engine for humans. BrowseAI Dev is research infrastructure for AI agents. It returns structured JSON (claims, sources, confidence, trace) that agents can programmatically evaluate — not a chat response. Available as MCP server, REST API, and Python SDK.",
              },
              {
                q: "Is the confidence score the LLM's self-assessment?",
                a: "No. The LLM never sees or sets the confidence score. It's computed post-extraction from 7 real signals: verification rate, domain authority, source count, consensus, domain diversity, claim grounding, and citation depth.",
              },
              {
                q: "What does 'self-improving accuracy' mean?",
                a: "Domain authority scores start from static tiers (gov/edu = high, content farms = low). Over time, real verification data from queries is blended in using Bayesian smoothing. Domains that consistently produce verified claims get higher scores; unreliable ones get lower scores. The system gets smarter with use.",
              },
              {
                q: "Can I self-host BrowseAI Dev?",
                a: "Yes — the code is MIT licensed. However, self-hosted instances miss the key advantages of the hosted service: the self-improving data flywheel (domain authority scores that get smarter from aggregated verification data across all users), shared cache (popular queries are instant), automatic updates, and upcoming Pro features (multi-model verification, priority queue). Self-hosted instances start with static domain scores and never improve beyond your own query volume.",
              },
              {
                q: "What do I miss by self-hosting?",
                a: "Three things you can't replicate by forking: (1) The data flywheel — hosted domain authority scores are continuously refined from thousands of queries across all users. A self-hosted instance only has its own data. (2) Shared cache — when someone else already searched your query, you get instant results. (3) Continuous improvement — new verification algorithms, domain tiers, and features ship to hosted users automatically.",
              },
              {
                q: "How is my query data used?",
                a: "Your queries are processed to generate answers and cached to improve response times. Anonymized, domain-level verification signals (e.g., 'wikipedia.org verified 82% of claims across 500 queries') are aggregated to improve domain authority scores for all users. Your specific queries are never shared with other users or used to train models. See our Privacy Policy for full details.",
              },
              {
                q: "What are Research Sessions?",
                a: "Sessions give your agents persistent memory across multiple research queries. Create a session, ask questions within it, and each query automatically stores verified claims. Follow-up queries recall prior findings before searching, building deeper understanding over time. Vague follow-ups like 'How does this work?' are automatically contextualized using the session's accumulated knowledge.",
              },
              {
                q: "What LLM does BrowseAI Dev use?",
                a: "Google Gemini 2.5 Flash via OpenRouter. The model extracts claims and generates answers. All verification (BM25, consensus, domain authority, contradictions) happens in code — not in the LLM.",
              },
            ].map((item) => (
              <div key={item.q} className="p-4 rounded-xl bg-card border border-border">
                <h4 className="text-sm font-semibold text-foreground mb-2">{item.q}</h4>
                <p className="text-xs">{item.a}</p>
              </div>
            ))}
          </Section>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <img src="/logo.svg" alt="BrowseAI Dev" className="w-4 h-4" />
            <span className="text-sm font-semibold">BrowseAI Dev</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 md:gap-6 text-xs text-muted-foreground">
            <a href="https://github.com/BrowseAI-HQ/BrowseAI-Dev" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
            <a href="https://discord.gg/ubAuT4YQsT" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Discord</a>
            <button onClick={() => navigate("/playground")} className="hover:text-foreground transition-colors">Playground</button>
            <button onClick={() => navigate("/developers")} className="hover:text-foreground transition-colors">Developers</button>
          </div>
        </div>
      </footer>
    </div>
    </>
  );
};

export default Docs;
