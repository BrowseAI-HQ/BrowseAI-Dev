import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search, ArrowRight, Zap, GitCompare, Terminal, Globe, Quote,
  Shield, ShieldAlert, CheckCircle2, Copy, Check, ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const EXAMPLE_PROMPTS = [
  "What is a wormhole?",
  "Why is the sky blue?",
  "What causes inflation?",
];

const TOOLS = [
  { name: "browse_search", desc: "Search the web for information on any topic" },
  { name: "browse_open", desc: "Fetch and parse a web page into clean text" },
  { name: "browse_extract", desc: "Extract structured claims from a page" },
  { name: "browse_answer", desc: "Full pipeline: search + extract + cite" },
  { name: "browse_compare", desc: "Compare raw LLM vs evidence-backed answer" },
];

const PIPELINE_STEPS = [
  { label: "Search", detail: "Tavily API" },
  { label: "Fetch", detail: "Readability" },
  { label: "Extract", detail: "Gemini Flash" },
  { label: "Graph", detail: "Evidence map" },
  { label: "Answer", detail: "Cited result" },
];

const Index = () => {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSearch = (q?: string) => {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    navigate(`/results?q=${encodeURIComponent(searchQuery.trim())}`);
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
        className="fixed top-0 left-0 right-0 flex items-center justify-between px-8 py-5 z-50 bg-background/80 backdrop-blur-sm border-b border-border/50"
      >
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-accent" />
          <span className="font-semibold text-sm tracking-tight">browse.ai</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={() => navigate("/playground")}>
            Playground
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" asChild>
            <a href="https://github.com/EiffelHack/ai-agent-browser" target="_blank" rel="noopener">GitHub</a>
          </Button>
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
              Open Source &middot; MCP Server &middot; REST API
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05]">
              Deep Research
              <br />
              <span className="text-gradient">for AI Agents</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto">
              Turn any AI assistant into a research engine with real-time web search,
              evidence extraction, and structured citations.
            </p>
          </div>

          {/* Search */}
          <div className="relative max-w-2xl mx-auto">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-accent transition-colors" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Try it: ask anything..."
                className="w-full h-14 pl-12 pr-36 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all text-base"
              />
              <Button
                onClick={() => handleSearch()}
                disabled={!query.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg px-4 h-10 text-sm font-semibold gap-2"
              >
                Search
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

      {/* ===== HOW IT WORKS ===== */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How it works</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Every answer goes through a 5-step pipeline. No hallucination. Every claim is backed by a real source.
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
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why browse-ai?</h2>
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
                <span className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">Browse AI</span>
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
              Works with Claude Desktop, Cursor, Windsurf, or any MCP-compatible AI assistant.
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
        "SERP_API_KEY": "your-tavily-key",
        "GEMINI_API_KEY": "your-gemini-key"
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
        "SERP_API_KEY": "your-tavily-key",
        "GEMINI_API_KEY": "your-gemini-key"
      }
    }
  }
}`}</pre>
            </div>

            {/* REST API */}
            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">REST API (any agent framework)</span>
                <button
                  onClick={() => copyText(`curl -X POST http://localhost:3001/browse/answer \\
  -H "Content-Type: application/json" \\
  -d '{"query": "What causes aurora borealis?"}'`, "api")}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  {copied === "api" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied === "api" ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="text-xs font-mono text-muted-foreground bg-secondary rounded-lg p-4 overflow-x-auto">{`curl -X POST http://localhost:3001/browse/answer \\
  -H "Content-Type: application/json" \\
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
              Each tool returns structured JSON. No HTML parsing, no hallucination.
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
                "Tavily Search", "Readability", "Gemini 2.5 Flash", "MCP Protocol",
                "Fastify", "React", "Supabase", "TypeScript",
              ].map((tech) => (
                <span key={tech} className="px-4 py-2 rounded-full bg-secondary border border-border text-sm text-muted-foreground">
                  {tech}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="py-12 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold">browse.ai</span>
            <span className="text-xs text-muted-foreground">Open-source deep research for AI agents</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <span>MIT License</span>
            <button onClick={() => navigate("/playground")} className="hover:text-foreground transition-colors">Playground</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
