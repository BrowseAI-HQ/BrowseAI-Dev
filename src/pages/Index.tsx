import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { motion } from "framer-motion";
import {
  Search, ArrowRight, GitCompare, Terminal, Globe, Quote,
  Shield, ShieldAlert, CheckCircle2, Copy, Check, ArrowDown, Target, Rocket, Github, Sparkles, Mail, Menu, Star, MessageCircle, LogIn, ExternalLink, Brain, Key,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { LoginModal } from "@/components/LoginModal";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/contexts/AuthContext";
import { useTypewriter } from "@/hooks/useTypewriter";
import { DepthToggle, isDepthBlocked } from "@/components/DepthToggle";

const EXAMPLE_PROMPTS = [
  "How do mRNA vaccines work?",
  "Solar vs wind energy comparison",
  "Latest JWST discoveries",
];

const TYPEWRITER_QUERIES = [
  "How does quantum computing work?",
  "Is nuclear energy safe?",
  "How does RAG improve LLMs?",
  "What causes ocean acidification?",
  "Kubernetes vs Docker Swarm?",
];

const TOOLS = [
  { name: "browse_search", desc: "Search the web for information on any topic" },
  { name: "browse_open", desc: "Fetch and parse a web page into clean text" },
  { name: "browse_extract", desc: "Extract structured claims from a page" },
  { name: "browse_answer", desc: "Full pipeline: search + extract + cite" },
  { name: "browse_compare", desc: "Compare raw LLM vs evidence-backed answer" },
  { name: "browse_session_create", desc: "Create a research session (requires bai_ API key)" },
  { name: "browse_session_ask", desc: "Research within a session (recalls prior knowledge)" },
  { name: "browse_session_recall", desc: "Query session knowledge without new web search" },
  { name: "browse_session_share", desc: "Share a session publicly for other agents to fork" },
  { name: "browse_session_knowledge", desc: "Export all accumulated claims from a session" },
  { name: "browse_session_fork", desc: "Fork a shared session to continue the research" },
  { name: "browse_feedback", desc: "Submit feedback to improve future search accuracy" },
];

const PIPELINE_STEPS = [
  { label: "Search", detail: "Multi-source" },
  { label: "Fetch", detail: "Page parsing" },
  { label: "Extract", detail: "Atomic claims" },
  { label: "Rerank", detail: "Neural + NLI" },
  { label: "Verify", detail: "BM25 + NLI" },
  { label: "Consensus", detail: "Multi-pass" },
  { label: "Answer", detail: "Streamed" },
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
  const [depth, setDepth] = useState<"fast" | "thorough" | "deep">("fast");
  const [showAllTools, setShowAllTools] = useState(false);
  const [showAllEndpoints, setShowAllEndpoints] = useState(false);
  const [showAllRoadmap, setShowAllRoadmap] = useState(false);

  const handleProWaitlist = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (user) {
      navigate("/dashboard");
    } else {
      const el = document.getElementById("waitlist");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  }, [user, navigate]);

  const handleSearch = (q?: string) => {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    const depthParam = depth !== "fast" ? `&depth=${depth}` : "";
    navigate(`/results?q=${encodeURIComponent(searchQuery.trim())}${depthParam}`);
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
    <>
    <SEO
      canonical="/"
      structuredData={{
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": "BrowseAI Dev",
        "description": "Research infrastructure for AI agents. Real-time web search with evidence-backed citations and confidence scores.",
        "url": "https://browseai.dev",
        "applicationCategory": "DeveloperApplication",
        "operatingSystem": "Any",
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
        "author": { "@type": "Organization", "name": "BrowseAI Dev", "url": "https://browseai.dev" },
        "license": "https://opensource.org/licenses/MIT",
        "codeRepository": "https://github.com/BrowseAI-HQ/BrowseAI-Dev",
        "programmingLanguage": ["TypeScript", "Python"],
      }}
    />
    <div className="min-h-screen">
      {/* Nav */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 flex items-center justify-between px-4 sm:px-8 py-5 z-50 bg-background/80 backdrop-blur-sm border-b border-border/50"
      >
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); navigate("/"); }}>
          <img src="/logo.svg" alt="BrowseAI Dev" className="w-5 h-5" />
          <span className="font-semibold text-sm tracking-tight hidden sm:inline">BrowseAI Dev</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Desktop nav links */}
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs hidden sm:inline-flex" onClick={() => navigate("/playground")}>
            Playground
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs hidden sm:inline-flex" onClick={() => navigate("/docs")}>
            Docs
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs hidden sm:inline-flex" onClick={() => navigate("/developers")}>
            Developers
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs hidden sm:inline-flex" onClick={() => navigate("/recipes")}>
            Recipes
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs hidden sm:inline-flex" asChild>
            <a href="https://discord.gg/ubAuT4YQsT" target="_blank" rel="noopener">
              <MessageCircle className="w-4 h-4" />
              <span className="ml-1">Discord</span>
            </a>
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs hidden sm:inline-flex" asChild>
            <a href="https://github.com/BrowseAI-HQ/BrowseAI-Dev" target="_blank" rel="noopener">
              <Github className="w-4 h-4" />
              <span className="ml-1">GitHub</span>
            </a>
          </Button>
          <button
            onClick={handleProWaitlist}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold hover:bg-accent/20 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {user ? "Dashboard" : "Pro Waitlist"}
          </button>

          {/* Mobile hamburger menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="sm:hidden">
                <Menu className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => navigate("/playground")}>Playground</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/docs")}>Docs</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/developers")}>Developers</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/recipes")}>Recipes</DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="https://github.com/BrowseAI-HQ/BrowseAI-Dev" target="_blank" rel="noopener" className="flex items-center gap-2">
                  <Star className="w-3.5 h-3.5" /> Star on GitHub
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="https://discord.gg/ubAuT4YQsT" target="_blank" rel="noopener" className="flex items-center gap-2">
                  <MessageCircle className="w-3.5 h-3.5" /> Join Discord
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleProWaitlist}>
                <Sparkles className="w-3.5 h-3.5" /> {user ? "Dashboard" : "Pro Waitlist"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground text-xs gap-1.5"
            onClick={() => user ? navigate("/dashboard#api-keys") : setLoginOpen(true)}
          >
            <Key className="w-4 h-4" />
            <span className="hidden sm:inline">Free BAI Key</span>
          </Button>
          {!authLoading && (user ? <UserMenu /> : (
            <Button variant="ghost" size="sm" className="text-muted-foreground text-xs gap-1.5" onClick={() => setLoginOpen(true)}>
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Sign in</span>
            </Button>
          ))}
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
                <div className="absolute left-12 right-16 sm:right-36 top-1/2 -translate-y-1/2 text-left text-muted-foreground text-sm sm:text-base pointer-events-none select-none truncate">
                  {typedText}<span className="animate-pulse">|</span>
                </div>
              )}
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isDepthBlocked(depth, !!user, null) && handleSearch()}
                aria-label="Search query"
                className="w-full h-14 pl-12 pr-16 sm:pr-36 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all text-base"
              />
              <Button
                onClick={() => handleSearch()}
                disabled={!query.trim() || isDepthBlocked(depth, !!user, null)}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg px-3 sm:px-4 h-10 text-sm font-semibold gap-2"
              >
                <span className="hidden sm:inline">Search</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <DepthToggle depth={depth} setDepth={setDepth} quota={null} size="pill" />
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleCompare} disabled={!query.trim()}>
              <GitCompare className="w-3.5 h-3.5" />
              Compare vs Raw LLM
            </Button>
            {user && (
              <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => navigate("/sessions")}>
                <Brain className="w-3.5 h-3.5" />
                Research Sessions
              </Button>
            )}
            {EXAMPLE_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => { if (!isDepthBlocked(depth, !!user, null)) { setQuery(prompt); handleSearch(prompt); } }}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-border text-xs sm:text-sm text-muted-foreground hover:text-foreground hover:border-accent/40 transition-all whitespace-nowrap ${isDepthBlocked(depth, !!user, null) ? "opacity-50 cursor-not-allowed" : ""}`}
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

      {/* ===== COMMUNITY CTA BANNER ===== */}
      <section className="py-8 px-6 border-t border-border bg-card/50">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4"
          >
            <a
              href="https://github.com/BrowseAI-HQ/BrowseAI-Dev"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-secondary border border-border text-sm font-medium hover:border-accent/40 hover:text-accent transition-all w-full sm:w-auto justify-center"
            >
              <Star className="w-3.5 h-3.5" />
              Star on GitHub
              <ExternalLink className="w-3 h-3 text-muted-foreground" />
            </a>
            <a
              href="https://discord.gg/ubAuT4YQsT"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#5865F2]/10 border border-[#5865F2]/20 text-sm font-medium text-[#5865F2] hover:bg-[#5865F2]/20 transition-all w-full sm:w-auto justify-center"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Join Discord
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
            {!user && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 px-5 py-2.5 h-auto text-sm border-accent/30 text-accent hover:bg-accent/10 w-full sm:w-auto justify-center"
                onClick={() => setLoginOpen(true)}
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign in free
              </Button>
            )}
            <button
              onClick={handleProWaitlist}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent/10 border border-accent/20 text-sm font-medium text-accent hover:bg-accent/20 transition-all w-full sm:w-auto justify-center"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {user ? "Go to Dashboard" : "Join Pro Waitlist"}
            </button>
          </motion.div>
        </div>
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
              <Rocket className="w-5 h-5 text-accent" />
              <h3 className="text-sm font-semibold uppercase tracking-wider">Where we're going</h3>
            </div>
            {(() => {
              const roadmapItems = [
                { phase: "Shipped", text: "Reliable research infrastructure — web search, evidence extraction, structured citations, Python SDK & MCP" },
                { phase: "Shipped", text: "Python SDK & framework integrations — pip install browseaidev + langchain-browseaidev, crewai-browseaidev, llamaindex-browseaidev" },
                { phase: "Shipped", text: "Multi-source verification — hybrid BM25 + NLI semantic entailment, cross-source consensus, contradiction detection, 10,000+ domain authority tiers" },
                { phase: "Shipped", text: "NLI evidence reranking — top-3 BM25 candidates reranked by DeBERTa semantic entailment for best evidence selection" },
                { phase: "Shipped", text: "Atomic claim decomposition — compound claims auto-split into individual verifiable facts for finer-grained verification" },
                { phase: "Shipped", text: "Multi-pass consistency — thorough mode cross-checks claims across extraction passes, penalizing inconsistencies (SelfCheckGPT-inspired)" },
                { phase: "Shipped", text: "Auto-calibrated confidence — predicted confidence auto-adjusts from user feedback data using isotonic calibration curves" },
                { phase: "Shipped", text: "Multi-provider search — parallel search across multiple providers for broader source diversity and stronger consensus" },
                { phase: "Shipped", text: "Thorough mode — auto-retries with rephrased queries when confidence is low, merges sources from both passes" },
                { phase: "Shipped", text: "Self-learning pipeline — adaptive thresholds, consensus tuning, confidence weight optimization, and user feedback loop" },
                { phase: "Shipped", text: "Token streaming — real-time SSE streaming with per-token answer delivery, automatic retry with exponential backoff on all external APIs" },
                { phase: "Shipped", text: "Neural cross-encoder re-ranker — semantic query-document scoring via cross-encoder for more relevant source selection before page fetching" },
                { phase: "Shipped", text: "Deep mode — premium verification with NLI reranking, multi-provider search, multi-pass consistency, and multi-step agentic reasoning. Requires BAI key, 100 deep queries/day (each costs 3x quota), graceful fallback to thorough" },
                { phase: "Shipped", text: "Research Memory — persistent sessions that accumulate knowledge across queries, with automatic recall of prior findings" },
                { phase: "Shipped", text: "Query Planning — intelligent decomposition of complex queries into focused sub-queries with intent labels" },
                { phase: "In Progress", text: "Knowledge graph & entity extraction — map relationships between claims and entities, build reusable queryable knowledge" },
                { phase: "Shipped", text: "Premium verification tier — NLI reranking, multi-provider search, and consistency checking via deep mode. Free BAI key users get 100 deep queries/day. Falls back to thorough when quota exhausted." },
                { phase: "Coming Soon", text: "Academic papers & broader sources — Semantic Scholar, arXiv, code search, real-time data feeds" },
                { phase: "Coming Soon", text: "Fine-tuned verification model — custom model trained on 10K+ production examples for per-domain calibration" },
                { phase: "Coming Soon", text: "Enterprise search adapters — plug into Elasticsearch, Confluence, or any custom endpoint with zero data retention (architecture ready)" },
              ];
              const visible = showAllRoadmap ? roadmapItems : roadmapItems.slice(0, 4);
              return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                    {visible.map((item, i) => (
                      <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border">
                        <Badge variant="outline" className={`shrink-0 mt-0.5 text-[10px] px-1.5 ${
                          item.phase === "Shipped" ? "text-emerald-400 border-emerald-400/30" :
                          item.phase === "In Progress" ? "text-amber-400 border-amber-400/30" :
                          "text-blue-400 border-blue-400/30"
                        }`}>
                          {item.phase}
                        </Badge>
                        <p className="text-sm text-muted-foreground leading-relaxed">{item.text}</p>
                      </div>
                    ))}
                  </div>
                  {roadmapItems.length > 4 && (
                    <div className="text-center mt-4">
                      <button
                        onClick={() => setShowAllRoadmap(!showAllRoadmap)}
                        className="text-xs text-accent hover:text-accent/80 font-medium transition-colors"
                      >
                        {showAllRoadmap ? "Show less" : `Show all ${roadmapItems.length} items`}
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </motion.div>
        </div>
      </section>

      {/* ===== GET A BAI KEY CTA ===== */}
      <section className="py-20 px-6 border-t border-border bg-accent/[0.03]">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
            <Badge variant="outline" className="text-xs font-normal mb-4 text-accent border-accent/30">100% Free</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Premium verification. Free API key.</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Get a <code className="text-xs bg-secondary px-1.5 py-0.5 rounded font-semibold text-accent">bai_</code> key and unlock features that make your agent's research significantly more accurate. One key works across MCP, REST API, and Python SDK.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="p-5 rounded-xl bg-card border border-border text-center">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mx-auto mb-3">
                  <Shield className="w-5 h-5 text-accent" />
                </div>
                <span className="font-semibold text-sm block mb-1">NLI Semantic Verification</span>
                <p className="text-xs text-muted-foreground">Evidence matched by meaning using DeBERTa entailment, not just keyword overlap</p>
              </div>
              <div className="p-5 rounded-xl bg-card border border-border text-center">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mx-auto mb-3">
                  <Globe className="w-5 h-5 text-accent" />
                </div>
                <span className="font-semibold text-sm block mb-1">Multi-Provider Search</span>
                <p className="text-xs text-muted-foreground">Parallel search across multiple sources for broader coverage and stronger consensus</p>
              </div>
              <div className="p-5 rounded-xl bg-card border border-border text-center">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mx-auto mb-3">
                  <Target className="w-5 h-5 text-accent" />
                </div>
                <span className="font-semibold text-sm block mb-1">Multi-Pass Consistency</span>
                <p className="text-xs text-muted-foreground">Claims cross-checked across independent extraction passes in thorough and deep modes</p>
              </div>
              <div className="p-5 rounded-xl bg-card border border-border text-center">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mx-auto mb-3">
                  <Brain className="w-5 h-5 text-accent" />
                </div>
                <span className="font-semibold text-sm block mb-1">Research Sessions</span>
                <p className="text-xs text-muted-foreground">Persistent memory across queries — later research recalls prior verified findings</p>
              </div>
            </div>

            <div className="text-center">
              <Button
                className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 px-6 h-11 text-sm font-semibold"
                onClick={() => user ? navigate("/dashboard#api-keys") : setLoginOpen(true)}
              >
                <LogIn className="w-4 h-4" />
                {user ? "Go to Dashboard" : "Get your free API key"}
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                Works without an account — MCP, SDK, and API all work with BYOK. Sign in to unlock NLI verification, multi-provider search, and more.
              </p>
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
              Every answer — whether from your agent or your own search — goes through a multi-step verification pipeline. Every claim is backed by a real source.
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
              <CheckCircle2 className="w-5 h-5 text-accent" />
              <span className="text-sm font-semibold text-muted-foreground">Example output</span>
            </div>
            <pre className="text-xs text-muted-foreground overflow-x-auto font-mono leading-relaxed">{`{
  "answer": "Aurora borealis occurs when charged particles from the Sun...",
  "claims": [
    { "claim": "Caused by solar wind particles...", "sources": ["https://..."],
      "verified": true, "verificationScore": 0.82, "consensusLevel": "strong" }
  ],
  "sources": [
    { "url": "https://...", "domain": "nasa.gov", "quote": "An aurora is...",
      "verified": true, "authority": 0.95 }
  ],
  "effectiveDepth": "deep",
  "confidence": 0.92,
  "trace": [
    { "step": "Search Web", "duration_ms": 340, "detail": "5 results" },
    { "step": "Verify Evidence", "duration_ms": 45, "detail": "3/3 claims verified" }
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
                <ShieldAlert className="w-5 h-5 text-orange-400" />
                <span className="text-sm font-semibold text-orange-400 uppercase tracking-wider">Raw LLM</span>
              </div>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><span className="text-orange-400 mt-0.5">-</span> No real sources, hallucinated citations</li>
                <li className="flex items-start gap-2"><span className="text-orange-400 mt-0.5">-</span> No verification — can't tell fact from fiction</li>
                <li className="flex items-start gap-2"><span className="text-orange-400 mt-0.5">-</span> Unknown reliability, no confidence signal</li>
                <li className="flex items-start gap-2"><span className="text-orange-400 mt-0.5">-</span> Stale training data, can't access current info</li>
                <li className="flex items-start gap-2"><span className="text-orange-400 mt-0.5">-</span> Single pass, no depth control</li>
                <li className="flex items-start gap-2"><span className="text-orange-400 mt-0.5">-</span> Claims mixed into unstructured text</li>
              </ul>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="p-6 rounded-xl bg-card border border-emerald-400/20">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">BrowseAI Dev</span>
              </div>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> Real URLs with quoted evidence</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> Hybrid BM25 + NLI verified claims against source text</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> Atomic claim decomposition — compound facts split and verified independently</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> Domain authority scoring (10,000+ domains)</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> Evidence-based confidence (7-factor score, auto-calibrated from feedback)</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> Neural re-ranking — cross-encoder semantic scoring for best source selection</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> 3 depth modes — fast (default), thorough (auto-retry + multi-pass), deep (premium: NLI reranking, multi-provider search, multi-pass consistency)</li>
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
                  onClick={() => copyText("npx browseai-dev setup", "setup")}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  {copied === "setup" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied === "setup" ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary">
                <Terminal className="w-4 h-4 text-accent" />
                <code className="text-sm font-mono">npx browseai-dev setup</code>
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
    "browseai-dev": {
      "command": "npx",
      "args": ["-y", "browseai-dev"],
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
    "browseai-dev": {
      "command": "npx",
      "args": ["-y", "browseai-dev"],
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
                  onClick={() => copyText("pip install browseaidev", "pip")}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  {copied === "pip" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied === "pip" ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary mb-3">
                <Terminal className="w-4 h-4 text-accent" />
                <code className="text-sm font-mono">pip install browseaidev</code>
              </div>
              <pre className="text-xs font-mono text-muted-foreground bg-secondary rounded-lg p-4 overflow-x-auto">{`from browseaidev import BrowseAIDev

client = BrowseAIDev(api_key="bai_xxx")
result = client.ask("What causes aurora borealis?")
print(result.answer, result.confidence)`}</pre>
              <p className="text-xs text-muted-foreground mt-3">
                LangChain: <code className="bg-secondary px-1 rounded">pip install langchain-browseaidev</code> · CrewAI: <code className="bg-secondary px-1 rounded">pip install crewai-browseaidev</code>
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

# Or with a BrowseAI Dev API key
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
            <h2 className="text-3xl md:text-4xl font-bold mb-4">12 Tools for Agents</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Each tool returns structured JSON with sources. No HTML parsing, no hallucination. Available via MCP and REST API.
            </p>
          </motion.div>

          <div className="space-y-3">
            {(showAllTools ? TOOLS : TOOLS.slice(0, 5)).map((tool, i) => (
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
          {TOOLS.length > 5 && (
            <div className="text-center mt-4">
              <button
                onClick={() => setShowAllTools(!showAllTools)}
                className="text-xs text-accent hover:text-accent/80 font-medium transition-colors"
              >
                {showAllTools ? "Show less" : `Show all ${TOOLS.length} tools`}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ===== API ENDPOINTS ===== */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">REST API</h2>
            <p className="text-muted-foreground">Use from LangChain, CrewAI, AutoGen, or any HTTP client.</p>
          </motion.div>

          {(() => {
            const endpoints = [
              { method: "POST", path: "/browse/search", desc: "Search the web" },
              { method: "POST", path: "/browse/open", desc: "Fetch & parse a page" },
              { method: "POST", path: "/browse/extract", desc: "Extract claims from a page" },
              { method: "POST", path: "/browse/answer", desc: "Full pipeline with citations" },
              { method: "POST", path: "/browse/compare", desc: "Raw LLM vs evidence-backed" },
              { method: "POST", path: "/browse/answer/stream", desc: "Streaming SSE (real-time progress)" },
              { method: "POST", path: "/browse/feedback", desc: "Submit accuracy feedback" },
              { method: "GET", path: "/browse/share/:id", desc: "Get a shared result" },
              { method: "GET", path: "/browse/stats", desc: "Total queries answered" },
              { method: "GET", path: "/browse/sources/top", desc: "Top cited sources" },
              { method: "GET", path: "/browse/analytics/summary", desc: "Usage analytics" },
              { method: "POST", path: "/session", desc: "Create research session (requires bai_ key)" },
              { method: "POST", path: "/session/:id/ask", desc: "Research with memory recall" },
              { method: "POST", path: "/session/:id/recall", desc: "Query session knowledge" },
              { method: "GET", path: "/session/:id/knowledge", desc: "Export session claims" },
              { method: "POST", path: "/session/:id/share", desc: "Share session publicly" },
              { method: "GET", path: "/session/share/:shareId", desc: "View shared session" },
              { method: "POST", path: "/session/share/:shareId/fork", desc: "Fork shared session" },
              { method: "GET", path: "/session/:id", desc: "Get session details" },
              { method: "GET", path: "/sessions", desc: "List your sessions" },
              { method: "DELETE", path: "/session/:id", desc: "Delete a session" },
            ];
            const visible = showAllEndpoints ? endpoints : endpoints.slice(0, 6);
            return (
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="space-y-3">
                {visible.map((ep) => (
                  <div key={ep.path} className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border">
                    <Badge variant="outline" className={`text-xs font-mono ${ep.method === "GET" ? "text-blue-400 border-blue-400/30" : ep.method === "DELETE" ? "text-red-400 border-red-400/30" : "text-emerald-400 border-emerald-400/30"}`}>
                      {ep.method}
                    </Badge>
                    <code className="text-sm font-mono text-foreground">{ep.path}</code>
                    <span className="text-sm text-muted-foreground ml-auto">{ep.desc}</span>
                  </div>
                ))}
                {endpoints.length > 6 && (
                  <div className="text-center mt-4">
                    <button
                      onClick={() => setShowAllEndpoints(!showAllEndpoints)}
                      className="text-xs text-accent hover:text-accent/80 font-medium transition-colors"
                    >
                      {showAllEndpoints ? "Show less" : `Show all ${endpoints.length} endpoints`}
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })()}
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
              Try it on the website or use your own keys via MCP, SDK &amp; API. Sign in for a free BAI key with premium verification.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 items-stretch">
            {/* No account */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="p-6 rounded-xl bg-card border border-border flex flex-col">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">No Account Needed</h3>
              <ul className="space-y-2.5 text-sm flex-1">
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> 5 queries/hour on website</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> All 5 tools + compare mode</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> BM25 keyword verification</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> MCP, Python SDK &amp; REST API</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> Unlimited with BYOK — no signup</li>
              </ul>
            </motion.div>

            {/* Free login */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="p-6 rounded-xl bg-card border border-accent/30 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-accent">Free Account</h3>
                <Badge variant="outline" className="text-[10px] text-accent border-accent/30">Recommended</Badge>
              </div>
              <ul className="space-y-2.5 text-sm flex-1">
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> Everything above, unlimited</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> Generous premium verification with BAI key</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> NLI + multi-provider search</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> Thorough + deep modes (100 deep/day)</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> Falls back to unlimited basic</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> One BAI key + history</li>
              </ul>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 w-full text-xs border-accent/30 text-accent hover:bg-accent/10"
                onClick={() => user ? navigate("/dashboard#api-keys") : setLoginOpen(true)}
              >
                {user ? "Go to Dashboard" : "Sign in \u2014 it\u2019s free"}
              </Button>
            </motion.div>

            {/* Pro */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="p-6 rounded-xl bg-card border border-yellow-500/20 relative overflow-hidden flex flex-col">
              <div className="absolute top-3 right-3">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/30">
                  <Sparkles className="w-3 h-3 text-yellow-400" />
                  <span className="text-[10px] font-semibold text-yellow-400">Coming Soon</span>
                </div>
              </div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Pro</h3>
              <ul className="space-y-2.5 text-sm text-muted-foreground flex-1">
                <li className="flex items-start gap-2"><Sparkles className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" /> Unlimited premium verification</li>
                <li className="flex items-start gap-2"><Sparkles className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" /> No quotas, no fallback</li>
                <li className="flex items-start gap-2"><Sparkles className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" /> Managed keys — no BYOK needed</li>
                <li className="flex items-start gap-2"><Sparkles className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" /> 15+ sources per query</li>
                <li className="flex items-start gap-2"><Sparkles className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" /> Multi-model verification</li>
                <li className="flex items-start gap-2"><Sparkles className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" /> Priority queue &amp; webhooks</li>
                <li className="flex items-start gap-2"><Sparkles className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" /> Team seats &amp; shared access</li>
              </ul>
              <button
                onClick={() => document.getElementById("waitlist-form")?.scrollIntoView({ behavior: "smooth" })}
                className="mt-4 w-full inline-flex items-center justify-center text-xs font-medium rounded-md border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 h-8 px-3 transition-colors"
              >
                Join waitlist
              </button>
            </motion.div>
          </div>

          {/* Enterprise — centered below */}
          <div className="max-w-lg mx-auto mb-16">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }} className="p-6 rounded-xl bg-card border border-blue-400/20 relative overflow-hidden">
              <div className="absolute top-3 right-3">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-400/10 border border-blue-400/20">
                  <Sparkles className="w-3 h-3 text-blue-400" />
                  <span className="text-[10px] font-semibold text-blue-400">Architecture Ready</span>
                </div>
              </div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Enterprise</h3>
              <p className="text-xs text-muted-foreground mb-3">The adapter architecture is built. Gauging demand before we ship.</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="flex items-start gap-2 text-sm text-muted-foreground"><Sparkles className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" /> Search adapters — Elasticsearch, Confluence, custom</div>
                <div className="flex items-start gap-2 text-sm text-muted-foreground"><Sparkles className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" /> Zero data retention mode</div>
                <div className="flex items-start gap-2 text-sm text-muted-foreground"><Sparkles className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" /> Full verification on your data</div>
                <div className="flex items-start gap-2 text-sm text-muted-foreground"><Sparkles className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" /> Your data never leaves your system</div>
              </div>
              <div className="text-center">
                <button
                  onClick={() => document.getElementById("waitlist-form")?.scrollIntoView({ behavior: "smooth" })}
                  className="inline-flex items-center justify-center text-xs font-medium rounded-md border border-blue-400/30 text-blue-400 hover:bg-blue-400/10 h-8 px-3 transition-colors"
                >
                  Join waitlist
                </button>
              </div>
            </motion.div>
          </div>

          {/* Waitlist form */}
          <motion.div id="waitlist-form" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-md mx-auto text-center space-y-4 scroll-mt-20">
            <p className="text-sm text-muted-foreground">
              Interested in Pro or Enterprise? Join the waitlist — we&apos;ll let you know when it&apos;s ready.
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
                <CheckCircle2 className="w-3.5 h-3.5" /> {waitlistMessage}
              </p>
            )}
            {waitlistStatus === "error" && (
              <p className="text-sm text-destructive">{waitlistMessage}</p>
            )}
          </motion.div>
        </div>
      </section>

      {/* ===== COMMUNITY BOTTOM CTA ===== */}
      <section className="py-16 px-6 border-t border-border">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Join the community</h2>
            <p className="text-muted-foreground text-sm">
              Star the repo, join Discord, and help shape the future of AI research infrastructure.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <a
              href="https://github.com/BrowseAI-HQ/BrowseAI-Dev"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-secondary border border-border text-sm font-semibold hover:border-accent/40 hover:text-accent transition-all w-full sm:w-auto justify-center"
            >
              <Star className="w-3.5 h-3.5" />
              Star on GitHub
            </a>
            <a
              href="https://discord.gg/ubAuT4YQsT"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#5865F2]/10 border border-[#5865F2]/20 text-sm font-semibold text-[#5865F2] hover:bg-[#5865F2]/20 transition-all w-full sm:w-auto justify-center"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Join Discord
            </a>
          </motion.div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="py-12 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="BrowseAI Dev" className="w-4 h-4" />
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
    <LoginModal open={loginOpen} onOpenChange={setLoginOpen} redirectTo="/dashboard" />
    </>
  );
};

export default Index;
