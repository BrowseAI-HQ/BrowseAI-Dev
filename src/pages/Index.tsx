import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search, ArrowRight, Zap, GitCompare, Terminal, Globe, Quote,
  Shield, ShieldAlert, CheckCircle2, Copy, Check, ArrowDown, Target, Rocket, Github, Sparkles, Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ApiKeySettings } from "@/components/ApiKeySettings";
import { LoginModal } from "@/components/LoginModal";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/contexts/AuthContext";
import { useTypewriter } from "@/hooks/useTypewriter";

const EXAMPLE_PROMPTS = [
  "What is a wormhole?",
  "Why is the sky blue?",
  "What causes inflation?",
];

const TYPEWRITER_QUERIES = [
  "What is quantum computing?",
  "How do black holes form?",
  "Why is the ocean salty?",
  "What causes northern lights?",
  "How does mRNA vaccine work?",
];

const TOOLS = [
  { name: "browse_search", desc: "Search the web for information on any topic" },
  { name: "browse_open", desc: "Fetch and parse a web page into clean text" },
  { name: "browse_extract", desc: "Extract structured claims from a page" },
  { name: "browse_answer", desc: "Full pipeline: search + extract + cite" },
  { name: "browse_compare", desc: "Compare raw LLM vs evidence-backed answer" },
];

const PIPELINE_STEPS = [
  { label: "Search", detail: "Web search" },
  { label: "Fetch", detail: "Page parsing" },
  { label: "Extract", detail: "Claim extraction" },
  { label: "Graph", detail: "Evidence map" },
  { label: "Answer", detail: "Cited result" },
];

const Index = () => {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistStatus, setWaitlistStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [waitlistMessage, setWaitlistMessage] = useState("");
  const navigate = useNavigate();
  const typedText = useTypewriter(TYPEWRITER_QUERIES);
  const { user, loading: authLoading } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  const handleSearch = (q?: string) => {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    navigate(`/results?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleWaitlist = async () => {
    if (!waitlistEmail.trim() || !/\S+@\S+\.\S+/.test(waitlistEmail)) return;
    setWaitlistStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: waitlistEmail.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setWaitlistStatus("success");
        setWaitlistMessage(data.message);
        setWaitlistEmail("");
      } else {
        setWaitlistStatus("error");
        setWaitlistMessage(data.error || "Something went wrong");
      }
    } catch {
      setWaitlistStatus("error");
      setWaitlistMessage("Network error. Try again.");
    }
  };

  const handleCompare = () => {
    if (!query.trim()) return;
    navigate(`/compare?q=${encodeURIComponent(query.trim())}`);
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 flex items-center justify-between px-4 sm:px-8 py-5 z-50 bg-background/80 backdrop-blur-sm border-b border-border/50"
      >
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="BrowseAI" className="w-5 h-5" />
          <span className="font-semibold text-sm tracking-tight">BrowseAI Dev</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={() => navigate("/playground")}>
            <Terminal className="w-4 h-4 sm:hidden" />
            <span className="hidden sm:inline">Playground</span>
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={() => navigate("/developers")}>
            <Rocket className="w-4 h-4 sm:hidden" />
            <span className="hidden sm:inline">Developers</span>
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={() => navigate("/recipes")}>
            <Zap className="w-4 h-4 sm:hidden" />
            <span className="hidden sm:inline">Recipes</span>
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" asChild>
            <a href="https://github.com/BrowseAI-HQ/BrowserAI-Dev" target="_blank" rel="noopener">
              <Github className="w-4 h-4 sm:hidden" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </Button>
          <a
            href="#waitlist"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold hover:bg-accent/20 transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            Pro Waitlist
          </a>
          <ApiKeySettings />
          {!authLoading && (user ? <UserMenu /> : <LoginModal />)}
        </div>
      </motion.nav>

      {/* ===== HERO SECTION ===== */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 pt-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="max-w-3xl w-full text-center space-y-8"
        >
          <div className="space-y-4">
            <Badge variant="outline" className="text-xs font-normal">
              Open Source &middot; For Agents &amp; Humans &middot; MCP &amp; REST API
            </Badge>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] sm:leading-[1.05]">
              Research Infra
              <br />
              <span className="text-gradient">for AI Agents</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto">
              The research infrastructure that gives AI agents real-time web search
              with evidence-backed citations. Python SDK, MCP &amp; REST API.
            </p>
          </div>

          {/* Search */}
          <div className="relative max-w-2xl mx-auto">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-accent transition-colors z-10" />
              {!query && (
                <div className="absolute left-12 top-1/2 -translate-y-1/2 text-muted-foreground text-base pointer-events-none select-none">
                  {typedText}<span className="animate-pulse">|</span>
                </div>
              )}
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-full h-14 pl-12 pr-16 sm:pr-36 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all text-base"
              />
              <Button
                onClick={() => handleSearch()}
                disabled={!query.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg px-3 sm:px-4 h-10 text-sm font-semibold gap-2"
              >
                <span className="hidden sm:inline">Search</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleCompare} disabled={!query.trim()}>
              <GitCompare className="w-3.5 h-3.5" />
              Compare vs Raw LLM
            </Button>
            {EXAMPLE_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => { setQuery(prompt); handleSearch(prompt); }}
                className="px-4 py-2 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground hover:border-accent/40 transition-all"
              >
                {prompt}
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="absolute bottom-8"
        >
          <ArrowDown className="w-5 h-5 text-muted-foreground/40 animate-bounce" />
        </motion.div>
      </section>

      {/* ===== THE ANTI-HALLUCINATION STACK ===== */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <Badge variant="outline" className="text-xs font-normal mb-6">
              The Problem
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">The Anti-Hallucination Stack</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              <span className="text-foreground font-semibold">$67.4 billion</span> — that's what AI hallucinations cost businesses in 2024.
              Every developer using AI agents has felt it: research that sounds right but isn't, citations that don't exist, decisions built on fiction.
              Whether it's your agent or you doing the research — the results should be reliable.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="text-center mb-12">
            <p className="text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              BrowseAI Dev was born from this problem. Every answer goes through a verification pipeline — real web search,
              real source extraction, real citations. No hallucinations. Just evidence.
            </p>
            <p className="text-sm text-muted-foreground/60 mt-4 italic">
              Built by a developer who got tired of AI making things up.
            </p>
          </motion.div>

          {/* Direction */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }}>
            <div className="flex items-center justify-center gap-2 mb-6">
              <Rocket className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-semibold uppercase tracking-wider">Where we're going</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {[
                { phase: "Today", text: "Reliable research infrastructure — web search, evidence extraction, structured citations, Python SDK & MCP" },
                { phase: "Today", text: "Python SDK & framework integrations — pip install browseai, works with LangChain and CrewAI out of the box" },
                { phase: "In Progress", text: "Multi-source verification — cross-reference claims across sources, consensus scoring, contradiction detection" },
                { phase: "In Progress", text: "Knowledge graph & entity extraction — map relationships between claims, build reusable knowledge" },
                { phase: "Later", text: "Academic papers & broader sources — Semantic Scholar, arXiv, code search, real-time data feeds" },
                { phase: "Later", text: "Streaming API & response formats — low-latency streaming for voice agents, brief/detailed modes" },
                { phase: "Later", text: "Contradiction detection — flag conflicting claims across sources, surface disagreements for agents" },
                { phase: "Later", text: "Multi-provider search — combine Tavily, Google, Bing for broader coverage and source diversity" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border">
                  <Badge variant="outline" className="shrink-0 mt-0.5 text-[10px] px-1.5">
                    {item.phase}
                  </Badge>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How it works</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Every answer — whether from your agent or your own search — goes through a 5-step verification pipeline. Every claim is backed by a real source.
            </p>
          </motion.div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {PIPELINE_STEPS.map((step, i) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-4"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-2">
                    <span className="text-lg font-bold text-accent">{i + 1}</span>
                  </div>
                  <span className="text-sm font-semibold">{step.label}</span>
                  <span className="text-xs text-muted-foreground">{step.detail}</span>
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-muted-foreground/40 hidden md:block" />
                )}
              </motion.div>
            ))}
          </div>

          {/* Example output */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16 p-6 rounded-xl bg-card border border-border"
          >
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold text-muted-foreground">Example output</span>
            </div>
            <pre className="text-xs text-muted-foreground overflow-x-auto font-mono leading-relaxed">{`{
  "answer": "Aurora borealis occurs when charged particles from the Sun...",
  "claims": [
    { "claim": "Caused by solar wind particles...", "sources": ["https://..."] }
  ],
  "sources": [
    { "url": "https://...", "domain": "wikipedia.org", "quote": "An aurora is..." }
  ],
  "confidence": 0.92,
  "trace": [
    { "step": "Search Web", "duration_ms": 340, "detail": "5 results" },
    { "step": "Fetch Pages", "duration_ms": 1200, "detail": "4 pages" }
  ]
}`}</pre>
          </motion.div>
        </div>
      </section>

      {/* ===== WHY BROWSE AI ===== */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why BrowseAI Dev?</h2>
            <p className="text-muted-foreground">Side-by-side: what you get vs a raw LLM</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="p-6 rounded-xl bg-card border border-orange-400/20">
              <div className="flex items-center gap-2 mb-4">
                <ShieldAlert className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-semibold text-orange-400 uppercase tracking-wider">Raw LLM</span>
              </div>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><span className="text-orange-400 mt-0.5">-</span> No real sources, hallucinated citations</li>
                <li className="flex items-start gap-2"><span className="text-orange-400 mt-0.5">-</span> Unknown reliability, no confidence signal</li>
                <li className="flex items-start gap-2"><span className="text-orange-400 mt-0.5">-</span> Stale training data, can't access current info</li>
                <li className="flex items-start gap-2"><span className="text-orange-400 mt-0.5">-</span> Claims mixed into unstructured text</li>
              </ul>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="p-6 rounded-xl bg-card border border-emerald-400/20">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">BrowseAI Dev</span>
              </div>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> Real URLs with quoted evidence</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> 0-1 confidence score per answer</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> Real-time web search, always current</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> Structured claims linked to sources</li>
              </ul>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mt-8 text-center">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setQuery("What causes aurora borealis?"); handleCompare(); }}>
              <GitCompare className="w-3.5 h-3.5" />
              Try Compare Mode
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ===== INSTALL FOR AGENTS ===== */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Install in 30 seconds</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Plug into Claude Desktop, Cursor, Windsurf, or any MCP-compatible AI assistant. Or use the search bar above — no setup needed.
            </p>
          </motion.div>

          {/* Quick install */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="space-y-6">
            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Setup</span>
                <button
                  onClick={() => copyText("npx browse-ai setup", "setup")}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  {copied === "setup" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied === "setup" ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary">
                <Terminal className="w-4 h-4 text-accent" />
                <code className="text-sm font-mono">npx browse-ai setup</code>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Prompts for your API keys and auto-writes the MCP config for Claude Desktop.
              </p>
            </div>

            {/* Manual config */}
            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Manual Config (Claude Desktop)</span>
                <button
                  onClick={() => copyText(`{
  "mcpServers": {
    "browse-ai": {
      "command": "npx",
      "args": ["-y", "browse-ai"],
      "env": {
        "SERP_API_KEY": "your-search-key",
        "OPENROUTER_API_KEY": "your-llm-key"
      }
    }
  }
}`, "manual")}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  {copied === "manual" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied === "manual" ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="text-xs font-mono text-muted-foreground bg-secondary rounded-lg p-4 overflow-x-auto">{`// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "browse-ai": {
      "command": "npx",
      "args": ["-y", "browse-ai"],
      "env": {
        "SERP_API_KEY": "your-search-key",
        "OPENROUTER_API_KEY": "your-llm-key"
      }
    }
  }
}`}</pre>
            </div>

            {/* Python SDK */}
            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Python SDK</span>
                <button
                  onClick={() => copyText("pip install browseai", "pip")}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  {copied === "pip" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied === "pip" ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary mb-3">
                <Terminal className="w-4 h-4 text-accent" />
                <code className="text-sm font-mono">pip install browseai</code>
              </div>
              <pre className="text-xs font-mono text-muted-foreground bg-secondary rounded-lg p-4 overflow-x-auto">{`from browseai import BrowseAI

client = BrowseAI(api_key="bai_xxx")
result = client.ask("What causes aurora borealis?")
print(result.answer, result.confidence)`}</pre>
              <p className="text-xs text-muted-foreground mt-3">
                Works with LangChain and CrewAI — <code className="bg-secondary px-1 rounded">pip install browseai[langchain]</code>
              </p>
            </div>

            {/* REST API */}
            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">REST API (any agent framework)</span>
                <button
                  onClick={() => copyText(`curl -X POST https://browseai.dev/api/browse/answer \\
  -H "Content-Type: application/json" \\
  -H "X-Tavily-Key: tvly-xxx" \\
  -H "X-OpenRouter-Key: sk-or-xxx" \\
  -d '{"query": "What causes aurora borealis?"}'`, "api")}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  {copied === "api" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied === "api" ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="text-xs font-mono text-muted-foreground bg-secondary rounded-lg p-4 overflow-x-auto">{`# BYOK — free, no limits
curl -X POST https://browseai.dev/api/browse/answer \\
  -H "Content-Type: application/json" \\
  -H "X-Tavily-Key: tvly-xxx" \\
  -H "X-OpenRouter-Key: sk-or-xxx" \\
  -d '{"query": "What causes aurora borealis?"}'

# Or with a BrowseAI API key
curl -X POST https://browseai.dev/api/browse/answer \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: bai_your_key" \\
  -d '{"query": "What causes aurora borealis?"}'`}</pre>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== MCP TOOLS ===== */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">5 Tools for Agents</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Each tool returns structured JSON with sources. No HTML parsing, no hallucination. Available via MCP and REST API.
            </p>
          </motion.div>

          <div className="space-y-3">
            {TOOLS.map((tool, i) => (
              <motion.div
                key={tool.name}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-accent/30 transition-colors"
              >
                <code className="text-sm font-mono text-accent font-semibold whitespace-nowrap">{tool.name}</code>
                <span className="text-sm text-muted-foreground">{tool.desc}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== API ENDPOINTS ===== */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">REST API</h2>
            <p className="text-muted-foreground">Use from LangChain, CrewAI, AutoGen, or any HTTP client.</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="space-y-3">
            {[
              { method: "POST", path: "/browse/search", desc: "Search the web" },
              { method: "POST", path: "/browse/open", desc: "Fetch & parse a page" },
              { method: "POST", path: "/browse/extract", desc: "Extract claims from a page" },
              { method: "POST", path: "/browse/answer", desc: "Full pipeline with citations" },
              { method: "POST", path: "/browse/compare", desc: "Raw LLM vs evidence-backed" },
              { method: "GET", path: "/browse/share/:id", desc: "Get a shared result" },
              { method: "GET", path: "/browse/stats", desc: "Total queries answered" },
              { method: "GET", path: "/browse/sources/top", desc: "Top cited sources" },
              { method: "GET", path: "/browse/analytics/summary", desc: "Usage analytics" },
            ].map((ep) => (
              <div key={ep.path} className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border">
                <Badge variant="outline" className={`text-xs font-mono ${ep.method === "GET" ? "text-blue-400 border-blue-400/30" : "text-emerald-400 border-emerald-400/30"}`}>
                  {ep.method}
                </Badge>
                <code className="text-sm font-mono text-foreground">{ep.path}</code>
                <span className="text-sm text-muted-foreground ml-auto">{ep.desc}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== TECH STACK ===== */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-4xl font-bold mb-12">Tech Stack</h2>
            <div className="flex flex-wrap justify-center gap-4">
              {[
                "Web Search", "Readability", "LLM", "MCP Protocol",
                "Fastify", "React", "Supabase", "TypeScript", "Python SDK",
              ].map((tech) => (
                <span key={tech} className="px-4 py-2 rounded-full bg-secondary border border-border text-sm text-muted-foreground">
                  {tech}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== FREE vs PRO ===== */}
      <section id="waitlist" className="py-24 px-6 border-t border-border scroll-mt-20">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Use it your way</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Everything works without an account. Sign in to unlock more — or just use BYOK and go.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {/* No account */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="p-6 rounded-xl bg-card border border-border">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">No Account</h3>
              <ul className="space-y-2.5 text-sm">
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> 5 free queries/hour</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> All 5 tools + compare mode</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> BYOK for unlimited access</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> MCP + REST API + Python SDK</li>
              </ul>
            </motion.div>

            {/* Free login */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="p-6 rounded-xl bg-card border border-accent/30">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-accent">Free Account</h3>
                <Badge variant="outline" className="text-[10px] text-accent border-accent/30">Recommended</Badge>
              </div>
              <ul className="space-y-2.5 text-sm">
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> Everything above, plus:</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> BrowseAI API key (one key for everything)</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> Query history &amp; dashboard</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> Usage analytics</li>
              </ul>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 w-full text-xs border-accent/30 text-accent hover:bg-accent/10"
                onClick={() => user ? navigate("/dashboard") : setLoginOpen(true)}
              >
                {user ? "Go to Dashboard" : "Sign in — it\u2019s free"}
              </Button>
              <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
            </motion.div>

            {/* Pro */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="p-6 rounded-xl bg-card border border-border relative overflow-hidden">
              <div className="absolute top-3 right-3">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20">
                  <Sparkles className="w-3 h-3 text-accent" />
                  <span className="text-[10px] font-semibold text-accent">Coming Soon</span>
                </div>
              </div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Pro</h3>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><Sparkles className="w-4 h-4 text-accent mt-0.5 shrink-0" /> Managed keys — no BYOK needed</li>
                <li className="flex items-start gap-2"><Sparkles className="w-4 h-4 text-accent mt-0.5 shrink-0" /> 15+ sources per query</li>
                <li className="flex items-start gap-2"><Sparkles className="w-4 h-4 text-accent mt-0.5 shrink-0" /> Multi-model verification</li>
                <li className="flex items-start gap-2"><Sparkles className="w-4 h-4 text-accent mt-0.5 shrink-0" /> Priority queue &amp; webhooks</li>
                <li className="flex items-start gap-2"><Sparkles className="w-4 h-4 text-accent mt-0.5 shrink-0" /> Team seats &amp; shared access</li>
              </ul>
            </motion.div>
          </div>

          {/* Pro waitlist */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-md mx-auto text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Want Pro? Join the waitlist — we&apos;ll let you know when it&apos;s ready.
            </p>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={waitlistEmail}
                  onChange={(e) => { setWaitlistEmail(e.target.value); setWaitlistStatus("idle"); }}
                  onKeyDown={(e) => e.key === "Enter" && handleWaitlist()}
                  className="w-full h-11 pl-10 pr-4 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all"
                />
              </div>
              <Button
                onClick={handleWaitlist}
                disabled={waitlistStatus === "loading" || !waitlistEmail.trim()}
                className="bg-accent text-accent-foreground hover:bg-accent/90 h-11 px-5 text-sm font-semibold"
              >
                {waitlistStatus === "loading" ? "Joining..." : "Join Waitlist"}
              </Button>
            </div>
            {waitlistStatus === "success" && (
              <p className="text-sm text-emerald-400 flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> {waitlistMessage}
              </p>
            )}
            {waitlistStatus === "error" && (
              <p className="text-sm text-destructive">{waitlistMessage}</p>
            )}
          </motion.div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="py-12 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="BrowseAI" className="w-4 h-4" />
            <span className="text-sm font-semibold">BrowseAI Dev</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Crafted with <span className="text-red-400">&#9829;</span> and a lot of <span className="text-amber-400">&#9889;</span> by <a href="https://www.instagram.com/shreyassaw/?hl=en" target="_blank" rel="noopener noreferrer" className="text-foreground font-medium hover:text-accent transition-colors">Shreyas</a>
          </p>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <a href="mailto:shreyassaw@gmail.com" className="hover:text-foreground transition-colors">shreyassaw@gmail.com</a>
            <a href="https://discord.gg/ubAuT4YQsT" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Discord</a>
            <a href="https://www.linkedin.com/in/shreyas-sawant" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">LinkedIn</a>
            <button onClick={() => navigate("/playground")} className="hover:text-foreground transition-colors">Playground</button>
            <button onClick={() => navigate("/privacy")} className="hover:text-foreground transition-colors">Privacy</button>
            <button onClick={() => navigate("/terms")} className="hover:text-foreground transition-colors">Terms</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
