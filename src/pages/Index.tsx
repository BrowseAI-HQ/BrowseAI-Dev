import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ArrowRight, GitCompare, Terminal, Globe, Quote,
  Shield, ShieldAlert, CheckCircle2, Copy, Check, ArrowDown, Target, Github, Sparkles, Mail, Menu, Star, MessageCircle, LogIn, Brain, Cpu, Key,
  Clock, Lock, HeartPulse, Scale, Code2, Newspaper, GraduationCap, ShieldCheck, DollarSign, Microscope, Building2,
  FileText, Share2, GitFork, ThumbsUp, Layers, Zap, Activity, Database,
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
import { ClarityToggle, isClarityBlocked } from "@/components/ClarityToggle";
import { saveRecentQuery } from "@/components/SearchInput";

const TYPEWRITER_QUERIES = [
  "How does quantum computing work?",
  "Is nuclear energy safe?",
  "Verify candidate claims on this resume",
  "How does RAG improve LLMs?",
  "Kubernetes vs Docker Swarm?",
];

// ── Autocomplete suggestions for landing page ──────────────────────

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const RECENT_KEY = "browseai_recent_queries";
function getRecentQueries(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
}

const suggestCache = new Map<string, string[]>();
async function fetchSuggestionsLanding(q: string): Promise<string[]> {
  const key = q.trim().toLowerCase();
  if (suggestCache.has(key)) return suggestCache.get(key)!;
  try {
    const res = await fetch(`${API_BASE}/browse/suggest?q=${encodeURIComponent(q.trim())}`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return [];
    const data = await res.json();
    const results = (data.result || []) as string[];
    suggestCache.set(key, results);
    if (suggestCache.size > 200) { const first = suggestCache.keys().next().value; if (first) suggestCache.delete(first); }
    return results;
  } catch { return []; }
}

type SuggestionItem = { text: string; type: "recent" | "suggest" };

function buildLandingSuggestions(input: string, apiResults: string[]): SuggestionItem[] {
  const q = input.trim().toLowerCase();
  const suggestions: SuggestionItem[] = [];
  const seen = new Set<string>();
  const add = (text: string, type: SuggestionItem["type"]) => {
    const key = text.toLowerCase();
    if (!seen.has(key) && key !== q) { seen.add(key); suggestions.push({ text, type }); }
  };
  const recent = getRecentQueries();
  if (!q) {
    for (const r of recent.slice(0, 5)) add(r, "recent");
  } else {
    for (const r of recent) { if (r.toLowerCase().includes(q)) add(r, "recent"); }
    for (const s of apiResults) add(s, "suggest");
  }
  return suggestions.slice(0, 8);
}

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
  const [clarityEnabled, setClarityEnabled] = useState(false);
  const [activeUseCase, setActiveUseCase] = useState(0);
  const [activeTool, setActiveTool] = useState<number | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const [apiSuggestions, setApiSuggestions] = useState<string[]>([]);
  // Dropdown close handled by onBlur + setTimeout
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced fetch from suggest API
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setApiSuggestions([]); return; }
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    suggestDebounceRef.current = setTimeout(() => {
      fetchSuggestionsLanding(q).then(setApiSuggestions);
    }, 150);
    return () => { if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current); };
  }, [query]);

  const searchSuggestions = buildLandingSuggestions(query, apiSuggestions);
  const showSuggestions = searchFocused && searchSuggestions.length > 0;

  useEffect(() => {
    setSelectedSuggestion(-1);
  }, [query, searchFocused]);

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
    saveRecentQuery(searchQuery.trim());
    // Auto-downgrade deep → thorough when user can't access deep mode
    const effectiveDepth = isDepthBlocked(depth, !!user, null) ? "thorough" : depth;
    const depthParam = effectiveDepth !== "fast" ? `&depth=${effectiveDepth}` : "";
    const clarityParam = clarityEnabled && !isClarityBlocked(!!user, null) ? "&clarity=true" : "";
    navigate(`/results?q=${encodeURIComponent(searchQuery.trim())}${depthParam}${clarityParam}`);
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
        "description": "Grounded Intelligence — research infrastructure for AI agents. Real-time web search with evidence-backed citations and confidence scores.",
        "url": "https://browseai.dev",
        "applicationCategory": "DeveloperApplication",
        "operatingSystem": "Any",
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
        "author": { "@type": "Organization", "name": "BrowseAI Dev", "url": "https://browseai.dev" },
        "license": "https://www.apache.org/licenses/LICENSE-2.0",
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
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs hidden sm:inline-flex" onClick={() => navigate("/alternatives")}>
            Alternatives
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
              <DropdownMenuItem onClick={() => navigate("/alternatives")}>Alternatives</DropdownMenuItem>
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
      <section className="min-h-screen flex flex-col items-center justify-center px-6 pt-20 relative">
        {/* Subtle grid background + radial glow */}
        <div className="absolute inset-0 grid-bg grid-bg-fade pointer-events-none" />
        <div className="hero-glow" />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="max-w-3xl w-full text-center space-y-8"
        >
          <div className="space-y-4">
            <Badge variant="outline" className="text-[10px] sm:text-xs font-normal gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              Powered by E2 Evidence Engine
            </Badge>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] sm:leading-[1.05]">
              Research Infra
              <br />
              <span className="text-shimmer">for AI Agents</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto">
              Real-time web search with evidence-backed citations and confidence scores.
              Not an LLM guessing — a dedicated evidence engine. MCP, Python SDK &amp; REST API.
            </p>
          </div>

          {/* Search with autocomplete */}
          <div className="relative max-w-2xl mx-auto">
            <div className="relative group">
              {isDepthBlocked(depth, !!user, null) ? (
                <>
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400 z-10" />
                  <div
                    className="w-full h-14 pl-12 pr-16 sm:pr-36 bg-purple-500/5 border border-purple-500/30 rounded-xl flex items-center cursor-pointer"
                    onClick={() => setLoginOpen(true)}
                  >
                    <span className="text-purple-400 text-sm">Sign in to unlock Deep mode</span>
                  </div>
                  <Button
                    onClick={() => setLoginOpen(true)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded-lg px-3 sm:px-4 h-10 text-sm font-semibold gap-2 z-10 border border-purple-500/30"
                  >
                    <LogIn className="w-4 h-4" />
                    <span className="hidden sm:inline">Sign In</span>
                  </Button>
                </>
              ) : clarityEnabled && isClarityBlocked(!!user, null) ? (
                <>
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-400 z-10" />
                  <div
                    className="w-full h-14 pl-12 pr-16 sm:pr-36 bg-amber-500/5 border border-amber-500/30 rounded-xl flex items-center cursor-pointer"
                    onClick={() => setLoginOpen(true)}
                  >
                    <span className="text-amber-400 text-sm">Clarity rewrites prompts to reduce hallucinations — requires BAI key, sign in to unlock</span>
                  </div>
                  <Button
                    onClick={() => setLoginOpen(true)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded-lg px-3 sm:px-4 h-10 text-sm font-semibold gap-2 z-10 border border-amber-500/30"
                  >
                    <LogIn className="w-4 h-4" />
                    <span className="hidden sm:inline">Sign In</span>
                  </Button>
                </>
              ) : (
                <>
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-accent transition-colors z-10" />
                  {!query && !searchFocused && (
                    <div className="absolute left-12 right-16 sm:right-36 top-1/2 -translate-y-1/2 text-left text-muted-foreground text-sm sm:text-base pointer-events-none select-none truncate">
                      {typedText}<span className="animate-pulse">|</span>
                    </div>
                  )}
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                    onKeyDown={(e) => {
                      if (showSuggestions) {
                        if (e.key === "ArrowDown") { e.preventDefault(); setSelectedSuggestion((prev) => Math.min(prev + 1, searchSuggestions.length - 1)); }
                        else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedSuggestion((prev) => Math.max(prev - 1, -1)); }
                        else if (e.key === "Enter") {
                          e.preventDefault();
                          if (selectedSuggestion >= 0) { const s = searchSuggestions[selectedSuggestion].text; setQuery(s); handleSearch(s); }
                          else { handleSearch(); }
                          setSearchFocused(false);
                        }
                        else if (e.key === "Escape") { setSearchFocused(false); }
                      } else if (e.key === "Enter") {
                        handleSearch();
                      }
                    }}
                    placeholder={searchFocused ? "Ask a research question…" : ""}
                    aria-label="Search query"
                    aria-autocomplete="list"
                    aria-expanded={showSuggestions}
                    className={`w-full h-14 pl-12 pr-16 sm:pr-36 bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all text-base ${showSuggestions ? "rounded-t-xl rounded-b-none border-b-transparent" : "rounded-xl"}`}
                  />
                  <Button
                    onClick={() => handleSearch()}
                    disabled={!query.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg px-3 sm:px-4 h-10 text-sm font-semibold gap-2 z-10"
                  >
                    <span className="hidden sm:inline">Search</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
            {/* Autocomplete dropdown */}
            <AnimatePresence>
              {showSuggestions && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute z-50 w-full bg-secondary border border-border border-t-0 rounded-b-xl shadow-lg overflow-hidden"
                >
                  {searchSuggestions.map((item, i) => (
                    <button
                      key={`${item.type}-${i}-${item.text}`}
                      onMouseDown={() => { setQuery(item.text); handleSearch(item.text); setSearchFocused(false); }}
                      onMouseEnter={() => setSelectedSuggestion(i)}
                      className={`flex items-center gap-3 w-full px-5 py-3 text-left text-sm transition-colors ${i === selectedSuggestion ? "bg-accent/10 text-accent" : "text-foreground hover:bg-muted/50"}`}
                    >
                      {item.type === "recent" ? (
                        <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                      ) : (
                        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="flex-1 truncate">{item.text}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <DepthToggle depth={depth} setDepth={setDepth} quota={null} size="pill" />
            <ClarityToggle enabled={clarityEnabled} setEnabled={setClarityEnabled} quota={null} size="pill" />
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
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="absolute bottom-8"
        >
          <ArrowDown className="w-5 h-5 text-muted-foreground/40 animate-bounce" />
        </motion.div>
      </section>

      {/* Trust bar removed — covered by Evidence Engine section below */}

      {/* ===== THE INTELLIGENCE LAYER — Flow Visual ===== */}
      <section className="py-24 px-6 border-t border-border overflow-hidden">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <Badge variant="outline" className="text-xs font-normal mb-6">Grounded Intelligence</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Agents act fast.
              <br />
              <span className="text-accent">We make them think first.</span>
            </h2>
          </motion.div>

          {/* Flow: Agent → BrowseAI Dev → Web */}
          <div className="relative flex flex-col md:flex-row items-center justify-center gap-4 md:gap-0">
            {/* Node 1: Your Agent */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="relative z-10 flex flex-col items-center gap-3 p-6 rounded-2xl bg-card border border-border w-48 shrink-0"
            >
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                <Cpu className="w-6 h-6 text-muted-foreground" />
              </div>
              <span className="text-sm font-semibold">Your Agent</span>
              <span className="text-[10px] text-muted-foreground text-center leading-tight">Any LLM. Any framework.<br/>Any agent.</span>
            </motion.div>

            {/* Animated connection 1 */}
            <div className="hidden md:flex items-center w-20 shrink-0">
              <div className="h-px w-full bg-gradient-to-r from-border to-accent/50 relative">
                <div className="absolute inset-0 overflow-hidden">
                  <div className="w-2 h-2 bg-accent rounded-full absolute top-1/2 -translate-y-1/2 animate-[flowRight_2s_ease-in-out_infinite]" />
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-accent shrink-0 -ml-1" />
            </div>
            <ArrowDown className="md:hidden w-4 h-4 text-accent" />

            {/* Node 2: BrowseAI Dev (center, highlighted) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="relative z-10 flex flex-col items-center gap-3 p-6 rounded-2xl bg-accent/5 border-2 border-accent/30 w-56 shrink-0 glow-pulse"
            >
              <div className="relative w-12 h-12 flex items-center justify-center animate-float">
                <Shield className="w-12 h-12 text-accent/30 absolute" />
                <img src="/logo.svg" alt="B" className="w-5 h-5 relative z-10" />
              </div>
              <span className="text-sm font-bold text-accent">BrowseAI Dev</span>
              <div className="flex flex-wrap justify-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full bg-accent/10 text-[10px] font-medium text-accent">Search</span>
                <span className="px-2 py-0.5 rounded-full bg-accent/10 text-[10px] font-medium text-accent">Verify</span>
                <span className="px-2 py-0.5 rounded-full bg-accent/10 text-[10px] font-medium text-accent">Score</span>
              </div>
              <span className="text-[10px] text-muted-foreground text-center leading-tight">Research infrastructure<br/>with trust scores</span>
            </motion.div>

            {/* Animated connection 2 */}
            <div className="hidden md:flex items-center w-20 shrink-0">
              <div className="h-px w-full bg-gradient-to-r from-accent/50 to-border relative">
                <div className="absolute inset-0 overflow-hidden">
                  <div className="w-2 h-2 bg-accent rounded-full absolute top-1/2 -translate-y-1/2 animate-[flowRight_2s_ease-in-out_0.5s_infinite]" />
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 -ml-1" />
            </div>
            <ArrowDown className="md:hidden w-4 h-4 text-muted-foreground" />

            {/* Node 3: The Web */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="relative z-10 flex flex-col items-center gap-3 p-6 rounded-2xl bg-card border border-border w-48 shrink-0"
            >
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                <Globe className="w-6 h-6 text-muted-foreground" />
              </div>
              <span className="text-sm font-semibold">The Web</span>
              <span className="text-[10px] text-muted-foreground text-center leading-tight">Real sources, verified<br/>quotes & citations</span>
            </motion.div>
          </div>

          {/* Before/After contrast */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto"
          >
            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <span className="text-xs font-semibold text-red-400">Without BrowseAI Dev</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Agent generates plausible-sounding text. No sources. No trust scores. You hope it's right.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-accent/5 border border-accent/20">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-accent" />
                <span className="text-xs font-semibold text-accent">With BrowseAI Dev</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Agent checks sources, sees trust scores, spots contradictions — then decides whether to act or reconsider.
              </p>
            </div>
          </motion.div>

          {/* ===== E2 EVIDENCE ENGINE — "One More Thing" Reveal ===== */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="mt-24"
          >
            <div className="relative max-w-4xl mx-auto">
              {/* E2 Evidence Engine — center stage */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="relative"
              >
                {/* Outer glow rings */}
                <div className="absolute inset-0 bg-accent/10 rounded-3xl blur-[80px] -z-10" />
                <div className="absolute -inset-6 bg-accent/[0.04] rounded-[40px] blur-3xl -z-10" />

                <div className="relative p-5 sm:p-8 md:p-12 rounded-2xl sm:rounded-3xl bg-gradient-to-b from-accent/[0.12] via-accent/[0.05] to-transparent border border-accent/30 overflow-hidden">
                  {/* Background grid pattern */}
                  <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)", backgroundSize: "24px 24px" }} />

                  {/* E2 badge */}
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                    className="flex justify-center mb-8"
                  >
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                      </span>
                      <span className="text-xs font-semibold text-accent tracking-wide">FINE-TUNED ON 2.39M EXAMPLES &amp; GROWING</span>
                    </div>
                  </motion.div>

                  {/* Neural network — bold E2 visualization (hidden on small mobile, simplified) */}
                  <div className="relative w-full h-36 sm:h-44 md:h-52 mb-6 md:mb-8 hidden sm:block">
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 600 180" fill="none">
                      <defs>
                        <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0" />
                        </radialGradient>
                        <radialGradient id="entailGlow" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#34d399" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                        </radialGradient>
                      </defs>
                      <circle cx="300" cy="85" r="60" fill="url(#coreGlow)" />

                      {/* Layer labels */}
                      <text x="55" y="172" fill="hsl(var(--muted-foreground))" opacity="0.6" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="600">CLAIMS</text>
                      <text x="175" y="172" fill="hsl(var(--accent))" opacity="0.8" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="600">ENCODE</text>
                      <text x="300" y="172" fill="hsl(var(--accent))" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="700">ATTENTION</text>
                      <text x="420" y="172" fill="hsl(var(--accent))" opacity="0.8" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="600">CLASSIFY</text>
                      <text x="535" y="172" fill="#34d399" opacity="0.9" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="700">VERDICT</text>

                      {/* Input layer — token blocks */}
                      {[25, 45, 65, 85, 105, 125, 145].map((y, i) => (
                        <g key={`in-${i}`}>
                          <rect x="35" y={y - 4} width="36" height="8" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.2" stroke="hsl(var(--muted-foreground))" strokeOpacity="0.3" strokeWidth="0.8">
                            <animate attributeName="opacity" values="0.15;0.35;0.15" dur={`${2 + i * 0.15}s`} repeatCount="indefinite" />
                          </rect>
                          {/* Connections to encoder — converge to encoder nodes */}
                          {[45, 65, 85, 105, 125].map((ey, j) => (
                            <line key={`ie-${i}-${j}`} x1="71" y1={y} x2="160" y2={ey} stroke="hsl(var(--accent))" strokeOpacity="0.07" strokeWidth="0.6">
                              <animate attributeName="stroke-opacity" values="0.04;0.15;0.04" dur={`${2.5 + (i + j) * 0.12}s`} repeatCount="indefinite" />
                            </line>
                          ))}
                        </g>
                      ))}

                      {/* Encoder layer nodes */}
                      {[45, 65, 85, 105, 125].map((y, i) => (
                        <g key={`enc-${i}`}>
                          <circle cx="175" cy={y} r="9" fill="hsl(var(--accent))" fillOpacity="0.1" stroke="hsl(var(--accent))" strokeOpacity="0.45" strokeWidth="1.5">
                            <animate attributeName="r" values="8;10;8" dur={`${2.5 + i * 0.25}s`} repeatCount="indefinite" />
                          </circle>
                          <circle cx="175" cy={y} r="3.5" fill="hsl(var(--accent))" fillOpacity="0.4">
                            <animate attributeName="opacity" values="0.3;0.7;0.3" dur={`${1.8 + i * 0.2}s`} repeatCount="indefinite" />
                          </circle>
                        </g>
                      ))}

                      {/* Encoder → Attention core — lines converge INTO the circle edge */}
                      {[45, 65, 85, 105, 125].map((y, i) => {
                        const angle = Math.atan2(y - 85, 175 - 300);
                        const edgeX = 300 + Math.cos(angle) * 24;
                        const edgeY = 85 + Math.sin(angle) * 24;
                        return (
                          <line key={`enc-att-${i}`} x1="185" y1={y} x2={edgeX} y2={edgeY}
                            stroke="hsl(var(--accent))"
                            strokeOpacity={y === 85 ? 0.35 : 0.12}
                            strokeWidth={y === 85 ? 2 : 1}
                          >
                            <animate attributeName="stroke-opacity" values={y === 85 ? "0.25;0.5;0.25" : "0.08;0.2;0.08"} dur={`${2.5 + i * 0.3}s`} repeatCount="indefinite" />
                          </line>
                        );
                      })}

                      {/* Attention core — pulsing hub */}
                      <circle cx="300" cy="85" r="24" fill="hsl(var(--accent))" fillOpacity="0.06" stroke="hsl(var(--accent))" strokeOpacity="0.3" strokeWidth="2">
                        <animate attributeName="r" values="22;26;22" dur="4s" repeatCount="indefinite" />
                        <animate attributeName="stroke-opacity" values="0.2;0.5;0.2" dur="4s" repeatCount="indefinite" />
                      </circle>
                      <circle cx="300" cy="85" r="13" fill="hsl(var(--accent))" fillOpacity="0.15" stroke="hsl(var(--accent))" strokeOpacity="0.5" strokeWidth="1.5">
                        <animate attributeName="r" values="11;15;11" dur="3s" repeatCount="indefinite" />
                      </circle>
                      <circle cx="300" cy="85" r="5" fill="hsl(var(--accent))" fillOpacity="0.7">
                        <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
                      </circle>

                      {/* Attention → Classifier — lines from circle edge to classifier nodes */}
                      {[55, 85, 115].map((y, i) => {
                        const angle = Math.atan2(y - 85, 420 - 300);
                        const edgeX = 300 + Math.cos(angle) * 24;
                        const edgeY = 85 + Math.sin(angle) * 24;
                        return (
                          <g key={`cls-${i}`}>
                            <line x1={edgeX} y1={edgeY} x2="410" y2={y} stroke="hsl(var(--accent))" strokeOpacity="0.2" strokeWidth="1.5">
                              <animate attributeName="stroke-opacity" values="0.12;0.35;0.12" dur={`${2.2 + i * 0.3}s`} repeatCount="indefinite" />
                            </line>
                            <circle cx="420" cy={y} r="8" fill="hsl(var(--accent))" fillOpacity="0.1" stroke="hsl(var(--accent))" strokeOpacity="0.4" strokeWidth="1.5" />
                            <circle cx="420" cy={y} r="3" fill="hsl(var(--accent))" fillOpacity="0.35" />
                          </g>
                        );
                      })}

                      {/* Classifier → Verdict outputs */}
                      {/* ENTAILS */}
                      <line x1="428" y1="55" x2="495" y2="42" stroke="#34d399" strokeOpacity="0.5" strokeWidth="2">
                        <animate attributeName="stroke-opacity" values="0.3;0.6;0.3" dur="2.5s" repeatCount="indefinite" />
                      </line>
                      <circle cx="535" cy="42" r="22" fill="url(#entailGlow)" />
                      <rect x="495" y="28" width="80" height="28" rx="6" fill="#34d399" fillOpacity="0.2" stroke="#34d399" strokeOpacity="0.6" strokeWidth="1.5">
                        <animate attributeName="fill-opacity" values="0.15;0.28;0.15" dur="3s" repeatCount="indefinite" />
                      </rect>
                      <text x="535" y="39" fill="#34d399" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="700">ENTAILS</text>
                      <text x="535" y="51" fill="#34d399" opacity="0.8" fontSize="8" fontFamily="monospace" textAnchor="middle">0.94</text>

                      {/* CONTRADICTS */}
                      <line x1="428" y1="85" x2="495" y2="88" stroke="#f87171" strokeOpacity="0.25" strokeWidth="1.5" />
                      <rect x="495" y="75" width="80" height="26" rx="6" fill="#f87171" fillOpacity="0.07" stroke="#f87171" strokeOpacity="0.2" strokeWidth="1" />
                      <text x="535" y="86" fill="#f87171" opacity="0.55" fontSize="8" fontFamily="monospace" textAnchor="middle" fontWeight="600">CONTRADICTS</text>
                      <text x="535" y="96" fill="#f87171" opacity="0.35" fontSize="7" fontFamily="monospace" textAnchor="middle">0.04</text>

                      {/* NEUTRAL */}
                      <line x1="428" y1="115" x2="495" y2="128" stroke="#fbbf24" strokeOpacity="0.15" strokeWidth="1" />
                      <rect x="495" y="118" width="80" height="26" rx="6" fill="#fbbf24" fillOpacity="0.05" stroke="#fbbf24" strokeOpacity="0.15" strokeWidth="1" />
                      <text x="535" y="129" fill="#fbbf24" opacity="0.45" fontSize="8" fontFamily="monospace" textAnchor="middle" fontWeight="600">NEUTRAL</text>
                      <text x="535" y="139" fill="#fbbf24" opacity="0.3" fontSize="7" fontFamily="monospace" textAnchor="middle">0.02</text>

                      {/* Particles: enter as accent, pass through attention, then split to verdicts with matching colors */}

                      {/* → ENTAILS (green) — most particles go here */}
                      {[0, 1, 2].map((i) => (
                        <g key={`p-entail-${i}`}>
                          {/* Accent-colored from input to attention */}
                          <circle r="3" fill="hsl(var(--accent))">
                            <animateMotion dur={`${4 + i * 0.8}s`} repeatCount="indefinite" path={`M55,${65 + i * 20} L175,${65 + i * 20} L300,85`} />
                            <animate attributeName="opacity" values="0;0.9;0.9;0" dur={`${4 + i * 0.8}s`} repeatCount="indefinite" />
                          </circle>
                          {/* Turns green from attention → ENTAILS */}
                          <circle r="3" fill="#34d399">
                            <animateMotion dur={`${4 + i * 0.8}s`} repeatCount="indefinite" path="M300,85 L420,55 L535,42" />
                            <animate attributeName="opacity" values="0;0;0;0.9;0.9;0" dur={`${4 + i * 0.8}s`} repeatCount="indefinite" />
                          </circle>
                        </g>
                      ))}

                      {/* → CONTRADICTS (red) — fewer particles */}
                      <g>
                        <circle r="2.5" fill="hsl(var(--accent))">
                          <animateMotion dur="5.5s" repeatCount="indefinite" path="M55,45 L175,45 L300,85" />
                          <animate attributeName="opacity" values="0;0.8;0.8;0" dur="5.5s" repeatCount="indefinite" />
                        </circle>
                        <circle r="2.5" fill="#f87171">
                          <animateMotion dur="5.5s" repeatCount="indefinite" path="M300,85 L420,85 L535,88" />
                          <animate attributeName="opacity" values="0;0;0;0.8;0.7;0" dur="5.5s" repeatCount="indefinite" />
                        </circle>
                      </g>

                      {/* → NEUTRAL (amber) — rare particle */}
                      <g>
                        <circle r="2" fill="hsl(var(--accent))">
                          <animateMotion dur="7s" repeatCount="indefinite" path="M55,125 L175,125 L300,85" />
                          <animate attributeName="opacity" values="0;0.7;0.7;0" dur="7s" repeatCount="indefinite" />
                        </circle>
                        <circle r="2" fill="#fbbf24">
                          <animateMotion dur="7s" repeatCount="indefinite" path="M300,85 L420,115 L535,128" />
                          <animate attributeName="opacity" values="0;0;0;0.7;0.6;0" dur="7s" repeatCount="indefinite" />
                        </circle>
                      </g>
                    </svg>
                  </div>

                  {/* Mobile-only: simple static pipeline flow */}
                  <div className="sm:hidden flex items-center justify-center gap-2 mb-6 py-4">
                    {["CLAIMS", "ENCODE", "ATTENTION", "CLASSIFY"].map((step, i) => (
                      <div key={step} className="flex items-center gap-2">
                        <div className={`px-2 py-1 rounded-md text-[8px] font-mono font-semibold tracking-wide ${
                          step === "ATTENTION" ? "bg-accent/15 text-accent border border-accent/30" : "bg-secondary border border-border text-muted-foreground"
                        }`}>{step}</div>
                        {i < 3 && <ArrowRight className="w-3 h-3 text-accent/40" />}
                      </div>
                    ))}
                    <ArrowRight className="w-3 h-3 text-emerald-400/60" />
                    <div className="px-2 py-1 rounded-md bg-emerald-400/10 border border-emerald-400/25 text-[8px] font-mono font-bold text-emerald-400 tracking-wide">VERDICT</div>
                  </div>

                  {/* E2 Title */}
                  <div className="text-center relative">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.15, duration: 0.4 }}
                    >
                      <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
                        E<sup className="text-sm sm:text-lg md:text-xl">2</sup> Evidence Engine
                      </h3>
                      <p className="text-sm sm:text-base text-muted-foreground mt-2 sm:mt-3 max-w-lg mx-auto">
                        Purpose-built NLI models fine-tuned on real verification data.
                        Not prompt engineering. Not chain-of-thought. Real neural inference.
                      </p>
                    </motion.div>

                    {/* Animated stats */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2, duration: 0.3 }}
                      className="grid grid-cols-3 gap-2 sm:gap-4 mt-6 sm:mt-8 max-w-lg mx-auto"
                    >
                      {[
                        { value: "2.39M", label: "Training Examples", sub: "Real verification pairs" },
                        { value: "3", label: "Model Sizes", sub: "Small · Base · Large" },
                        { value: "13", label: "Pipeline Steps", sub: "Search → Verify → Score" },
                      ].map((stat, i) => (
                        <motion.div
                          key={stat.label}
                          initial={{ opacity: 0, scale: 0.9 }}
                          whileInView={{ opacity: 1, scale: 1 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.25 + i * 0.06 }}
                          className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-accent/[0.04] border border-accent/10"
                        >
                          <div className="text-lg sm:text-xl md:text-2xl font-bold text-accent">{stat.value}</div>
                          <div className="text-[10px] sm:text-[11px] font-semibold text-foreground mt-1">{stat.label}</div>
                          <div className="text-[9px] sm:text-[10px] text-muted-foreground">{stat.sub}</div>
                        </motion.div>
                      ))}
                    </motion.div>
                  </div>
                </div>
              </motion.div>

              {/* Three model tiers */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="mt-10"
              >
                <h4 className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-6">Three models. One mission. Evidence over guesswork.</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      name: "E2-Small",
                      model: "Fine-tuned NLI model",
                      params: "44M params",
                      speed: "~8ms",
                      mode: "Fast mode",
                      desc: "Fine-tuned for instant verification. Sub-10ms latency on CPU — built for real-time agents.",
                      color: "emerald",
                      icon: Zap,
                    },
                    {
                      name: "E2-Base",
                      model: "Fine-tuned NLI model",
                      params: "86M params",
                      speed: "~25ms",
                      mode: "Thorough mode",
                      desc: "Fine-tuned production workhorse. Best accuracy-to-speed ratio for research tasks.",
                      color: "accent",
                      icon: Shield,
                    },
                    {
                      name: "E2-Large",
                      model: "Fine-tuned NLI model",
                      params: "304M params",
                      speed: "~80ms",
                      mode: "Deep mode",
                      desc: "Fine-tuned for maximum accuracy on high-stakes decisions. Multi-pass cross-verification.",
                      color: "purple",
                      icon: Brain,
                    },
                  ].map((tier, i) => {
                    const TierIcon = tier.icon;
                    return (
                      <motion.div
                        key={tier.name}
                        initial={{ opacity: 0, y: 15 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.15 + i * 0.08 }}
                        className="relative p-5 rounded-xl border border-border bg-card hover:border-accent/15 transition-all duration-300"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            tier.color === "emerald" ? "bg-emerald-400/10" : tier.color === "purple" ? "bg-purple-400/10" : "bg-accent/10"
                          }`}>
                            <TierIcon className={`w-4 h-4 ${
                              tier.color === "emerald" ? "text-emerald-400" : tier.color === "purple" ? "text-purple-400" : "text-accent"
                            }`} />
                          </div>
                          <div>
                            <h5 className="text-sm font-bold">{tier.name}</h5>
                            <span className="text-[10px] text-muted-foreground font-mono">{tier.model}</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-4">{tier.desc}</p>
                        <div className="flex items-center gap-3 text-[10px]">
                          <span className="px-2 py-0.5 rounded-full bg-secondary border border-border font-mono">{tier.params}</span>
                          <span className="px-2 py-0.5 rounded-full bg-secondary border border-border font-mono">{tier.speed}/claim</span>
                          <span className={`px-2 py-0.5 rounded-full font-medium ${
                            tier.color === "emerald" ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20" :
                            tier.color === "purple" ? "bg-purple-400/10 text-purple-400 border border-purple-400/20" :
                            "bg-accent/10 text-accent border border-accent/20"
                          }`}>{tier.mode}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>

              {/* Self-learning flywheel */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 }}
                className="mt-10 p-6 rounded-2xl bg-gradient-to-r from-accent/[0.04] via-accent/[0.08] to-accent/[0.04] border border-accent/15"
              >
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-4 h-4 text-accent" />
                      <h4 className="text-sm font-bold">Self-Improving Flywheel</h4>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Every query generates NLI training pairs. Every user feedback signal recalibrates confidence via isotonic regression.
                      The models improve continuously — no manual retraining needed.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {["Query", "Verify", "Learn", "Improve"].map((step, i) => (
                      <div key={step} className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                          i === 3 ? "bg-accent/15 text-accent border border-accent/25" : "bg-secondary border border-border text-muted-foreground"
                        }`}>{step}</span>
                        {i < 3 && <ArrowRight className="w-3 h-3 text-muted-foreground/40" />}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Pipeline steps */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="flex flex-wrap justify-center gap-2 mt-8"
              >
                {[
                  "Multi-provider search",
                  "Atomic claim decomposition",
                  "BM25 + dense retrieval",
                  "Reciprocal Rank Fusion",
                  "NLI entailment scoring",
                  "NLI reranking",
                  "Cross-source consensus",
                  "Contradiction detection",
                  "Counter-query adversarial",
                  "Domain authority (Bayesian)",
                  "Isotonic calibration",
                  "Multi-pass consistency",
                  "Confidence scoring (8-factor)",
                ].map((step, i) => (
                  <motion.span
                    key={step}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.22 + i * 0.02 }}
                    className="px-3 py-1.5 rounded-full bg-card border border-border text-[10px] text-muted-foreground font-medium hover:border-accent/20 hover:text-accent transition-colors"
                  >
                    {step}
                  </motion.span>
                ))}
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== BUILT FOR EVERY AGENT — Interactive Showcase ===== */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <Badge variant="outline" className="text-xs font-normal mb-6">Use Cases</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Superpowers for every agent</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              MCP, Python SDK, REST API — plug in however you build. Your agent gets the evidence. It decides what to trust.
            </p>
          </motion.div>

          {(() => {
            const useCases = [
              { icon: HeartPulse, title: "Healthcare Agent", desc: "Verify medical claims against peer-reviewed sources. Flag contradictions between studies. Confidence scores clinicians can trust.", example: "Is intermittent fasting safe for diabetics?", depth: "thorough" as const, github: "healthcare-agent", snippet: `result = client.ask(\n  "Is intermittent fasting safe for diabetics?",\n  depth="thorough"\n)\nfor claim in result.claims:\n  if not claim.verified:\n    print(f"⚠ Unverified: {claim.text}")` },
              { icon: FileText, title: "HR & Recruiting", desc: "Verify candidate claims against web evidence — publications, achievements, skills, speaking history. Flag unverifiable resume claims before hiring.", example: "Verify this candidate's published research and speaking history", depth: "thorough" as const, github: "hr-recruiting-agent", snippet: `result = client.ask(\n  "Verify: John Doe published 3 papers on "\n  "NLP at ACL 2024 and spoke at PyCon",\n  depth="thorough"\n)\nfor claim in result.claims:\n  status = "Verified" if claim.verified else "Unverified"\n  print(f"{status} ({claim.score:.0%}): {claim.text}")` },
              { icon: Scale, title: "Legal Research", desc: "Cross-reference legal precedents across jurisdictions. Verify regulatory claims with authoritative sources. Cite specific rulings.", example: "GDPR requirements for AI-generated content", depth: "thorough" as const, github: "legal-agent", snippet: `result = client.ask(\n  "GDPR requirements for AI-generated content",\n  depth="thorough"\n)\nfor source in result.sources:\n  print(f"[{source.domain}] {source.title}")` },
              { icon: Code2, title: "Coding Agent", desc: "Research libraries, APIs, and best practices before writing code. Verify documentation claims. Compare framework trade-offs.", example: "Best Python library for WebSocket servers?", depth: "fast" as const, github: "coding-agent", snippet: `result = client.ask(\n  "Best Python library for WebSocket servers?"\n)\nprint(result.answer)\nprint(f"Confidence: {result.confidence:.0%}")` },
              { icon: Newspaper, title: "Content & Media", desc: "Fact-check articles before publishing. Detect contradictions across sources. Research briefs with inline citations.", example: "Health effects of intermittent fasting", depth: "thorough" as const, github: "content-agent", snippet: `result = client.ask(\n  "Health effects of intermittent fasting",\n  depth="thorough"\n)\nfor c in result.contradictions:\n  print(f"Conflict: {c.claim_a} vs {c.claim_b}")` },
              { icon: GraduationCap, title: "Education Agent", desc: "Verify claims with primary sources. Cross-check multiple perspectives. Surface disagreements in the literature.", example: "What was before the Big Bang?", depth: "deep" as const, github: "education-agent", snippet: `result = client.ask(\n  "What was before the Big Bang?",\n  depth="deep"\n)\nfor claim in result.claims:\n  print(f"{'✓' if claim.verified else '?'} {claim.text}")` },
              { icon: ShieldCheck, title: "Support Agent", desc: "Verify answers before sending to customers. Ensure responses are backed by authoritative sources. Reduce misinformation.", example: "How does GDPR affect SaaS data storage?", depth: "fast" as const, github: "support-agent", snippet: `result = client.ask(\n  "How does GDPR affect SaaS data storage?"\n)\nif result.confidence > 0.7:\n  send_to_customer(result.answer)` },
              { icon: DollarSign, title: "Financial Agent", desc: "Verify market claims and financial data against multiple sources. Flag unverified statistics. Score source reliability.", example: "Tesla revenue and delivery numbers 2025", depth: "thorough" as const, github: "financial-agent", snippet: `result = client.ask(\n  "Tesla revenue and delivery numbers 2025",\n  depth="thorough"\n)\nfor s in result.sources:\n  print(f"{s.domain}: authority {s.authority:.0%}")` },
              { icon: Microscope, title: "Scientific Review", desc: "Cross-check research findings across publications. Detect contradictions. Separate consensus from contested claims.", example: "Current consensus on dark matter vs modified gravity", depth: "deep" as const, github: "scientific-agent", snippet: `result = client.ask(\n  "Dark matter vs modified gravity consensus",\n  depth="deep"\n)\nprint(f"Contradictions: {len(result.contradictions)}")` },
              { icon: Building2, title: "Enterprise Search", desc: "Plug into your internal search (Elasticsearch, Confluence). Verify claims against your own data. Zero data retention.", example: "Verify internal docs against latest regulations", depth: "fast" as const, github: "enterprise-search.py", snippet: `result = client.ask(\n  "Verify docs against regulations",\n  search_provider={\n    "type": "elasticsearch",\n    "endpoint": "https://es.internal"\n  }\n)` },
            ];
            const active = useCases[activeUseCase];
            const ActiveIcon = active.icon;
            return (
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flex flex-col lg:flex-row gap-0 rounded-xl border border-border overflow-hidden bg-card">
                {/* Sidebar */}
                <div className="lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-border relative">
                  {/* Mobile scroll hint */}
                  <div className="lg:hidden absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-card to-transparent z-10 pointer-events-none flex items-center justify-end pr-1">
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground animate-pulse" />
                  </div>
                  <div className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible scrollbar-hide">
                    {useCases.map((uc, i) => {
                      const Icon = uc.icon;
                      return (
                        <button
                          key={uc.title}
                          onClick={() => setActiveUseCase(i)}
                          className={`flex items-center gap-3 px-4 py-3 text-left text-sm transition-all duration-200 whitespace-nowrap lg:whitespace-normal w-full border-l-2 lg:border-l-2 ${
                            i === activeUseCase
                              ? "bg-accent/5 border-accent text-foreground font-medium"
                              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                          }`}
                        >
                          <Icon className={`w-4 h-4 shrink-0 ${i === activeUseCase ? "text-accent" : ""}`} />
                          <span className="truncate">{uc.title}</span>
                          {i === activeUseCase && <ArrowRight className="w-3 h-3 text-accent ml-auto hidden lg:block" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Preview panel */}
                <div className="flex-1 p-6 lg:p-8 min-h-[400px] flex flex-col">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeUseCase}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                      className="flex-1 flex flex-col"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                            <ActiveIcon className="w-5 h-5 text-accent" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold">{active.title}</h3>
                            <span className="text-xs text-muted-foreground">depth: {active.depth}</span>
                          </div>
                        </div>
                        <a
                          href={`https://github.com/BrowseAI-HQ/BrowseAI-Dev/tree/main/examples/${active.github}`}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-secondary border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-accent/30 transition-colors"
                        >
                          Use template <ArrowRight className="w-3.5 h-3.5" />
                        </a>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-muted-foreground leading-relaxed mb-6">{active.desc}</p>

                      {/* Code preview — styled like a flow/terminal */}
                      <div className="flex-1 rounded-lg bg-background border border-border overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-secondary/50">
                          <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-400/40" />
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/40" />
                            <div className="w-2.5 h-2.5 rounded-full bg-green-400/40" />
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono ml-2">{active.github}/agent.py</span>
                        </div>
                        <pre className="p-4 text-xs font-mono text-muted-foreground leading-relaxed overflow-x-auto">
                          <code>{`from browseaidev import BrowseAIDev\nclient = BrowseAIDev(api_key="bai_xxx")\n\n${active.snippet}`}</code>
                        </pre>
                      </div>

                      {/* Example query + Try it */}
                      <div className="flex items-center gap-3 mt-4">
                        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 border border-border">
                          <Search className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                          <span className="text-xs text-muted-foreground italic truncate">"{active.example}"</span>
                        </div>
                        <button
                          onClick={() => navigate(`/results?q=${encodeURIComponent(active.example)}${active.depth !== "fast" ? `&depth=${active.depth}` : ""}`)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent/10 border border-accent/20 text-xs font-medium text-accent hover:bg-accent/20 transition-colors shrink-0"
                        >
                          <ArrowRight className="w-3 h-3" />
                          Try it live
                        </button>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })()}
        </div>
      </section>

      {/* ===== FOR HUMANS TOO ===== */}
      <section className="py-24 px-6 border-t border-border relative">
        <div className="absolute inset-0 grid-bg grid-bg-fade pointer-events-none opacity-30" />
        <div className="max-w-5xl mx-auto relative">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <Badge variant="outline" className="text-xs font-normal mb-6">Not Just for Agents</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Research you can trust. <span className="text-shimmer">For everyone.</span></h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Agents use our infrastructure. But so can you. Every search is verified, every claim is sourced, every answer has a confidence score.</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: DollarSign, title: "Shopping & Products", desc: "\"Best noise-cancelling headphones under $300\" — with real reviews, not sponsored content.", query: "Best noise-cancelling headphones under $300 in 2026" },
              { icon: HeartPulse, title: "Health & Wellness", desc: "\"Is intermittent fasting effective?\" — verified against medical sources, not influencer claims.", query: "Is intermittent fasting effective for weight loss?" },
              { icon: Newspaper, title: "News & Current Events", desc: "\"What's really happening with AI regulation?\" — cross-referenced across multiple outlets.", query: "What are the latest AI regulations in 2026?" },
              { icon: GraduationCap, title: "Learning & Education", desc: "\"How do mRNA vaccines work?\" — explained with cited sources, not hallucinated details.", query: "How do mRNA vaccines work?" },
              { icon: Scale, title: "Legal & Finance", desc: "\"Can my landlord raise rent 20%?\" — backed by actual legal sources for your jurisdiction.", query: "What are tenant rights for rent increases?" },
              { icon: Microscope, title: "Deep Research", desc: "\"Quantum computing vs classical for drug discovery\" — multi-source analysis with contradictions surfaced.", query: "Quantum computing advantages for drug discovery" },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: Math.min(i * 0.08, 0.4) }}
                className="group p-5 rounded-xl border border-border bg-card/50 card-lift hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5 cursor-pointer"
                onClick={() => navigate(`/results?q=${encodeURIComponent(item.query)}&depth=thorough`)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
                    <item.icon className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">{item.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mt-10">
            <Button variant="outline" size="sm" onClick={() => navigate("/playground")} className="gap-2 hover:border-accent/30">
              <Search className="w-3.5 h-3.5" /> Try it yourself
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ===== THE TOOLKIT — Interactive ===== */}
      <section className="py-24 px-6 border-t border-border relative">
        <div className="absolute inset-0 grid-bg grid-bg-fade pointer-events-none opacity-50" />
        <div className="max-w-5xl mx-auto relative">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <Badge variant="outline" className="text-xs font-normal mb-6">The Toolkit</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything an agent needs.</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              13 MCP tools. 6 integrations. Click any to see its API, SDK, and code.
            </p>
          </motion.div>

          {(() => {
            const tools = [
              // Core tools
              { title: "Search", desc: "Multi-provider parallel web search. Real sources ranked and fetched.", icon: Search, mcp: "browse_search", endpoint: "POST /browse/search", sdk: "client.search(\"query\")", snippet: `result = client.search("quantum computing")\nfor r in result.results:\n  print(f"{r.title} — {r.url}")`, category: "core" },
              { title: "Open", desc: "Fetch and parse any web page into clean text. Strips ads, nav, boilerplate.", icon: FileText, mcp: "browse_open", endpoint: "POST /browse/open", sdk: "client.open(url)", snippet: `page = client.open("https://arxiv.org/abs/2301.00001")\nprint(page.title)\nprint(page.text[:500])  # Clean parsed content`, category: "core" },
              { title: "Extract", desc: "Pull structured claims, quotes, and knowledge from any URL.", icon: Quote, mcp: "browse_extract", endpoint: "POST /browse/extract", sdk: "client.extract(url)", snippet: `result = client.extract(\n  "https://arxiv.org/abs/2301.00001"\n)\nfor claim in result.claims:\n  print(f"{claim.text} [{claim.score:.0%}]")`, category: "core" },
              { title: "Answer", desc: "Full research pipeline — search, verify, cite. Three depth modes: fast, thorough, deep.", icon: Shield, mcp: "browse_answer", endpoint: "POST /browse/answer", sdk: "client.ask(query, depth=...)", snippet: `result = client.ask(\n  "Is nuclear fusion viable by 2035?",\n  depth="thorough"\n)\nprint(f"Confidence: {result.confidence:.0%}")\nprint(f"Sources: {len(result.sources)}")`, category: "core" },
              { title: "Compare", desc: "Raw LLM vs evidence-backed — side by side. See hallucination exposed.", icon: GitCompare, mcp: "browse_compare", endpoint: "POST /browse/compare", sdk: "client.compare(query)", snippet: `result = client.compare(\n  "Effects of creatine on muscle growth"\n)\nprint(f"Raw LLM: {result.raw[:100]}...")\nprint(f"Verified: {result.verified[:100]}...")`, category: "core" },
              { title: "Clarity", desc: "Anti-hallucination engine. Three modes: prompt rewriting, grounded answers, verified fusion.", icon: Sparkles, mcp: "browse_clarity", endpoint: "POST /browse/clarity", sdk: "client.clarity(query, mode=...)", snippet: `# Mode: "prompt" | "answer" | "verified"\nresult = client.clarity(\n  "Explain CRISPR gene editing",\n  mode="verified"\n)\nprint(result.answer)  # Grounded in sources`, category: "core" },
              // Sessions & Memory
              { title: "Session Create", desc: "Start a persistent research session. Knowledge accumulates across queries.", icon: Brain, mcp: "browse_session_create", endpoint: "POST /session", sdk: "client.session(name)", snippet: `session = client.session("AI safety research")\nr1 = session.ask("What is AI alignment?")\nr2 = session.ask("Who are the key researchers?")\n# r2 has context from r1`, category: "sessions" },
              { title: "Session Recall", desc: "Query accumulated knowledge without new web searches.", icon: Layers, mcp: "browse_session_recall", endpoint: "POST /session/:id/recall", sdk: "session.recall(query)", snippet: `# No new web search — queries memory only\nrecall = session.recall(\n  "What did we learn about alignment?"\n)\nprint(recall.answer)  # From accumulated knowledge`, category: "sessions" },
              { title: "Session Share", desc: "Share your research session publicly. Anyone can view via URL.", icon: Share2, mcp: "browse_session_share", endpoint: "POST /session/:id/share", sdk: "session.share()", snippet: `share_url = session.share()\nprint(f"Share: {share_url}")\n# Anyone can view all findings + sources`, category: "sessions" },
              { title: "Session Fork", desc: "Fork a shared session to continue building on someone else's research.", icon: GitFork, mcp: "browse_session_fork", endpoint: "POST /session/share/:id/fork", sdk: "client.fork_session(share_id)", snippet: `# Build on a colleague's research\nforked = client.fork_session("share_abc123")\nresult = forked.ask("What's missing from this?")`, category: "sessions" },
              { title: "Knowledge Export", desc: "Export all verified claims and sources from a session.", icon: Layers, mcp: "browse_session_knowledge", endpoint: "GET /session/:id/knowledge", sdk: "session.knowledge()", snippet: `entries = session.knowledge()\nfor entry in entries:\n  print(f"[{entry.confidence:.0%}] {entry.claim}")\n  for s in entry.sources:\n    print(f"  — {s.url}")`, category: "sessions" },
              // Feedback & Learning
              { title: "Feedback", desc: "Submit feedback on results. Improves verification accuracy over time.", icon: ThumbsUp, mcp: "browse_feedback", endpoint: "POST /browse/feedback", sdk: "client.feedback(id, rating)", snippet: `# Help improve the system\nclient.feedback(\n  result_id=result.id,\n  rating="good",  # or "bad", "wrong"\n  comment="Missed a key source"\n)`, category: "feedback" },
              { title: "Stream", desc: "Real-time SSE streaming. Get search, verify, and answer progress live.", icon: Layers, mcp: "browse_answer (stream)", endpoint: "POST /browse/answer/stream", sdk: "SSE via REST API", snippet: `# Server-Sent Events streaming\nimport httpx\nwith httpx.stream("POST", url, json=payload) as r:\n  for line in r.iter_lines():\n    event = json.loads(line)\n    print(event["stage"], event["progress"])`, category: "core" },
            ];
            const active = activeTool !== null ? tools[activeTool] : null;
            return (
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Tool selector — compact sidebar */}
                <div className="lg:w-52 shrink-0 rounded-xl border border-border bg-card overflow-hidden">
                  <div className="max-h-[280px] overflow-y-auto lg:max-h-[460px]">
                    {(["core", "sessions", "feedback"] as const).map((cat, ci) => {
                      const catTools = tools.filter(t => t.category === cat);
                      const catLabel = cat === "core" ? "Core" : cat === "sessions" ? "Sessions" : "More";
                      return (
                        <div key={cat}>
                          {ci > 0 && <div className="border-t border-border" />}
                          <div className="px-3 py-1.5 bg-secondary/30">
                            <span className="text-[9px] text-muted-foreground/70 uppercase tracking-widest font-semibold">{catLabel}</span>
                          </div>
                          {catTools.map((tool) => {
                            const i = tools.indexOf(tool);
                            const ToolIcon = tool.icon;
                            const isActive = activeTool === i;
                            return (
                              <button
                                key={tool.title}
                                onClick={() => setActiveTool(isActive ? null : i)}
                                className={`flex items-center gap-2 w-full px-3 py-2 text-left text-xs transition-all duration-150 border-l-2 ${
                                  isActive
                                    ? "bg-accent/5 text-accent font-medium border-accent"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/20 border-transparent"
                                }`}
                              >
                                <ToolIcon className={`w-3 h-3 shrink-0 ${isActive ? "text-accent" : ""}`} />
                                <span className="truncate">{tool.title}</span>
                                {isActive && <ArrowRight className="w-2.5 h-2.5 text-accent ml-auto shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Detail panel / Default JSON preview */}
                <div className="flex-1 min-h-[380px]">
                  <AnimatePresence mode="wait">
                    {active ? (
                      <motion.div
                        key={`tool-${activeTool}`}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                        className="h-full rounded-xl bg-card border border-accent/20 overflow-hidden terminal-card"
                      >
                        {/* Tool header */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                              {(() => { const I = active.icon; return <I className="w-4 h-4 text-accent" />; })()}
                            </div>
                            <div>
                              <h3 className="text-sm font-bold">{active.title}</h3>
                              <p className="text-[10px] text-muted-foreground">{active.desc}</p>
                            </div>
                          </div>
                          <div className="w-2 h-2 rounded-full bg-accent dot-pulse" />
                        </div>

                        {/* Access methods */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-border">
                          {[
                            { label: "MCP", value: active.mcp },
                            { label: "REST", value: active.endpoint },
                            { label: "Python", value: active.sdk },
                          ].map((method) => (
                            <div key={method.label} className="bg-card px-3 py-2.5">
                              <span className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-1">{method.label}</span>
                              <code className="text-[10px] font-mono text-accent">{method.value}</code>
                            </div>
                          ))}
                        </div>

                        {/* Code example */}
                        <div className="flex items-center gap-2 px-4 py-2 border-t border-b border-border bg-secondary/30">
                          <div className="flex gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-red-400/40" />
                            <div className="w-2 h-2 rounded-full bg-yellow-400/40" />
                            <div className="w-2 h-2 rounded-full bg-green-400/40" />
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono ml-1">example.py</span>
                        </div>
                        <pre className="p-4 text-[11px] font-mono text-muted-foreground leading-relaxed overflow-x-auto">
                          <code>{`from browseaidev import BrowseAIDev\nclient = BrowseAIDev(api_key="bai_xxx")\n\n${active.snippet}`}</code>
                        </pre>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="default-json"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="h-full rounded-xl bg-card border border-border overflow-hidden terminal-card"
                      >
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-secondary/30">
                          <div className="flex gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-red-400/40" />
                            <div className="w-2 h-2 rounded-full bg-yellow-400/40" />
                            <div className="w-2 h-2 rounded-full bg-green-400/40" />
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono ml-2">response.json</span>
                          <span className="ml-auto text-[10px] text-accent font-mono">200 OK</span>
                        </div>
                        <pre className="p-5 text-[11px] text-muted-foreground overflow-x-auto font-mono leading-relaxed">{`{
  "answer": "Aurora borealis occurs when charged
    particles from the Sun interact with...",
  `}<span className="text-accent">"confidence"</span>{`: 0.92,
  "claims": [
    {
      "claim": "Solar wind particles collide
        with atmospheric gases...",
      `}<span className="text-accent">"verified"</span>{`: true,
      "score": 0.82,
      "consensus": "strong"
    }
  ],
  "sources": [
    {
      "url": "https://science.nasa.gov/...",
      "domain": "nasa.gov",
      `}<span className="text-accent">"authority"</span>{`: 0.95,
      "quote": "An aurora is a natural light
        display in Earth's sky..."
    }
  ],
  "contradictions": []
}`}</pre>
                        <div className="px-5 pb-4">
                          <p className="text-[10px] text-muted-foreground/60 italic text-center">Click any tool to see its API, MCP command, and code example</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })()}

          {/* Integration badges with hover tooltips */}
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mt-10">
            <div className="flex items-center justify-center gap-3 md:gap-4 py-3 flex-wrap">
              {([
                { name: "MCP Server", hint: "npx browseai-dev" },
                { name: "REST API", hint: "POST browseai.dev/api/browse/*" },
                { name: "Python SDK", hint: "pip install browseaidev" },
                { name: "LangChain", hint: "pip install langchain-browseaidev" },
                { name: "CrewAI", hint: "pip install crewai-browseaidev" },
                { name: "LlamaIndex", hint: "pip install llamaindex-browseaidev" },
                { name: "SSE Streaming", hint: "POST /browse/answer/stream" },
                { name: "Free API Keys", hint: "Get a bai_ key at browseai.dev" },
              ]).map((item, i) => (
                <motion.span
                  key={item.name}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04 }}
                  title={item.hint}
                  className="group relative px-3 py-1.5 rounded-full bg-secondary/50 border border-border text-xs text-muted-foreground hover:text-accent hover:border-accent/20 transition-all duration-200 whitespace-nowrap cursor-default"
                >
                  {item.name}
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg bg-popover border border-border text-[10px] font-mono text-accent whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-lg z-10">
                    {item.hint}
                  </span>
                </motion.span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== WHY BROWSE AI ===== */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <Badge variant="outline" className="text-xs font-normal mb-6">The Difference</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Raw LLM vs <span className="text-accent">E<sup className="text-base">2</sup> Evidence Engine</span></h2>
            <p className="text-muted-foreground">LLMs guess. E2 verifies. Your agent deserves the difference.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="p-6 rounded-xl bg-card border border-red-500/10 hover:border-red-500/20 transition-all duration-300">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                </div>
                <span className="text-sm font-semibold text-red-400 uppercase tracking-wider">Raw LLM</span>
              </div>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {["No real sources, hallucinated citations", "No verification — can't tell fact from fiction", "Unknown reliability, no confidence signal", "Stale training data, can't access current info", "Single pass, no depth control", "Claims mixed into unstructured text"].map((item, i) => (
                  <motion.li key={i} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="flex items-start gap-2.5 py-1">
                    <span className="w-5 h-5 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5"><span className="text-red-400 text-xs">-</span></span>
                    {item}
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="p-6 rounded-xl bg-card border border-accent/20 hover:border-accent/30 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-accent" />
                </div>
                <span className="text-sm font-semibold text-accent uppercase tracking-wider">E2 Evidence Engine</span>
              </div>
              <ul className="space-y-3 text-sm">
                {[
                  "Fine-tuned NLI verification models",
                  "2.39M+ real training examples & growing",
                  "Atomic claim decomposition",
                  "Bayesian domain authority scoring",
                  "8-factor confidence, isotonic calibration",
                  "BM25 + dense embeddings + RRF fusion",
                  "3 models — E2-Small, Base, Large",
                  "Self-improving with every query",
                ].map((item, i) => (
                  <motion.li key={i} initial={{ opacity: 0, x: 10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="flex items-start gap-2.5 py-1">
                    <span className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5"><CheckCircle2 className="w-3 h-3 text-accent" /></span>
                    {item}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-8 text-center">
            <Button variant="outline" size="sm" className="gap-1.5 hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5 transition-all duration-300" onClick={() => { setQuery("What causes aurora borealis?"); handleCompare(); }}>
              <GitCompare className="w-3.5 h-3.5" />
              Try Compare Mode — see the difference live
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ===== GET STARTED ===== */}
      <section className="py-24 px-6 border-t border-border relative">
        <div className="absolute inset-0 grid-bg grid-bg-fade pointer-events-none opacity-30" />
        <div className="max-w-5xl mx-auto relative">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <Badge variant="outline" className="text-xs font-normal mb-6">Get Started</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ship in 30 seconds.</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Pick your integration. Start building.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* MCP Server */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="p-5 rounded-xl bg-card border border-border hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-accent uppercase tracking-wider">MCP Server</span>
                <button onClick={() => copyText("npx browseai-dev setup", "setup")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  {copied === "setup" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied === "setup" ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary mb-2">
                <Terminal className="w-4 h-4 text-accent" />
                <code className="text-sm font-mono">npx browseai-dev setup</code>
              </div>
              <p className="text-xs text-muted-foreground">Auto-configures Claude Desktop, Cursor, Windsurf, or any MCP client.</p>
            </motion.div>

            {/* Python SDK */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="p-5 rounded-xl bg-card border border-border hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-accent uppercase tracking-wider">Python SDK</span>
                <button onClick={() => copyText("pip install browseaidev", "pip")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  {copied === "pip" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied === "pip" ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary mb-2">
                <Terminal className="w-4 h-4 text-accent" />
                <code className="text-sm font-mono">pip install browseaidev</code>
              </div>
              <pre className="text-xs font-mono text-muted-foreground bg-secondary rounded-lg p-3 overflow-x-auto">{`from browseaidev import BrowseAIDev
client = BrowseAIDev(api_key="bai_xxx")
result = client.ask("What causes aurora borealis?")`}</pre>
            </motion.div>

            {/* REST API */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="p-5 rounded-xl bg-card border border-border hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-accent uppercase tracking-wider">REST API</span>
                <button onClick={() => copyText(`curl -X POST https://browseai.dev/api/browse/answer -H "Content-Type: application/json" -H "X-API-Key: bai_xxx" -d '{"query": "What causes aurora borealis?"}'`, "api")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  {copied === "api" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied === "api" ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="text-xs font-mono text-muted-foreground bg-secondary rounded-lg p-3 overflow-x-auto">{`curl -X POST https://browseai.dev/api/browse/answer \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: bai_your_key" \\
  -d '{"query": "What causes aurora borealis?"}'`}</pre>
              <p className="text-xs text-muted-foreground mt-2">Works with any HTTP client or agent framework. Free API keys available.</p>
            </motion.div>

            {/* Framework Integrations */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="p-5 rounded-xl bg-card border border-border hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5">
              <span className="text-xs font-semibold text-accent uppercase tracking-wider block mb-3">Agent Frameworks</span>
              <div className="space-y-2">
                {[
                  { name: "LangChain", pkg: "langchain-browseaidev" },
                  { name: "CrewAI", pkg: "crewai-browseaidev" },
                  { name: "LlamaIndex", pkg: "llamaindex-browseaidev" },
                ].map((fw) => (
                  <div key={fw.name} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary">
                    <span className="text-sm font-medium">{fw.name}</span>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-muted-foreground font-mono">pip install {fw.pkg}</code>
                      <button onClick={() => copyText(`pip install ${fw.pkg}`, fw.name)} className="text-muted-foreground hover:text-foreground">
                        {copied === fw.name ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">Drop-in tools: Search, Answer, Extract, Compare, and Clarity.</p>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mt-8 text-center">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/docs")}>
              Full documentation <ArrowRight className="w-3 h-3" />
            </Button>
          </motion.div>
        </div>
      </section>


      {/* ===== FREE vs PRO ===== */}
      <section id="waitlist" className="py-24 px-6 border-t border-border scroll-mt-20">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <Badge variant="outline" className="text-xs font-normal mb-6">Pricing</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Free to start. Scale when ready.</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              No credit card. Free API keys with premium verification included.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 items-stretch">
            {/* No account */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="p-6 rounded-xl bg-card border border-border flex flex-col card-lift hover:border-accent/10">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Website Demo</h3>
              <ul className="space-y-2.5 text-sm flex-1">
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> 1 free query on website</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> All tools + compare mode</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> Standard keyword verification</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> Try instantly — no signup needed</li>
              </ul>
            </motion.div>

            {/* Free login */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="p-6 rounded-xl flex flex-col gradient-border glow-pulse">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-accent">Free Account</h3>
                <Badge variant="outline" className="text-[10px] text-accent border-accent/30">Recommended</Badge>
              </div>
              <ul className="space-y-2.5 text-sm flex-1">
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> MCP, Python SDK &amp; REST API access</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> 100 premium queries/day with BAI key</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> Semantic verification + multi-provider search</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> Thorough + deep modes</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> Falls back to unlimited basic after quota</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> One BAI key + query history</li>
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
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="p-6 rounded-xl bg-card border border-yellow-500/20 relative overflow-hidden flex flex-col card-lift">
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
                <li className="flex items-start gap-2"><Sparkles className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" /> Managed keys — zero configuration</li>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
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
      <section className="py-20 px-6 border-t border-border relative">
        <div className="absolute inset-0 grid-bg grid-bg-fade pointer-events-none opacity-20" />
        <div className="max-w-2xl mx-auto text-center space-y-6 relative">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">The E<sup className="text-base">2</sup> Evidence Engine is open — <span className="text-accent">and you can build on it.</span></h2>
            <p className="text-muted-foreground text-sm">
              Open source SDKs. Purpose-built verification models. Star the repo, join Discord, and help build the trust layer agents deserve.
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
          <div className="flex items-center justify-center gap-4 sm:gap-6 text-xs text-muted-foreground flex-wrap">
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
