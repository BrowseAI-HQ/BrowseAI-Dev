import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { motion } from "framer-motion";
import {
  ArrowLeft, Play, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Globe, Copy, Check, Code2, ChevronDown, ChevronUp, ExternalLink,
  ThumbsUp, ThumbsDown, Brain, FileText, Beaker, LogIn, Lock, Shield, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DepthToggle, isDepthBlocked, formatResetTime } from "@/components/DepthToggle";
import { ClarityToggle, isClarityBlocked } from "@/components/ClarityToggle";
import {
  browseSearch, browseExtract, browseCompare, browseOpen, browseFeedback, browseClarity,
  type BrowseSource, type BrowseClaim, type QuotaInfo, type ClarityResult,
} from "@/lib/api/browse";
import { streamAnswer as streamAnswerApi, type TraceEvent, type SourcePreview, type StreamEvent, type PremiumQuota } from "@/lib/api/stream";
import { StreamingAnswer } from "@/components/results/StreamingAnswer";
import { StreamingPipeline } from "@/components/results/StreamingPipeline";
import { FollowUpSuggestions } from "@/components/FollowUpSuggestions";
import { SearchInput, saveRecentQuery } from "@/components/SearchInput";
import { LoginModal } from "@/components/LoginModal";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/contexts/AuthContext";
import { VerifyDocumentTab } from "@/components/playground/VerifyDocumentTab";

// ── Example queries per tab ─────────────────────────────────────────

const TABS = ["answer", "search", "open", "extract", "compare", "verify"] as const;

const EXAMPLES: Record<string, string[]> = {
  answer: [
    "How do mRNA vaccines work?",
    "Is nuclear energy safe for climate?",
    "How does RAG improve LLM accuracy?",
  ],
  search: [
    "AI safety regulations 2024",
    "CRISPR clinical trials results",
    "quantum computing breakthroughs",
  ],
  open: [
    "https://en.wikipedia.org/wiki/Transformer_(deep_learning_architecture)",
    "https://openai.com/index/gpt-4-research/",
  ],
  extract: [
    "https://en.wikipedia.org/wiki/Large_language_model",
    "https://arxiv.org/abs/2303.08774",
  ],
  compare: [
    "Health effects of intermittent fasting",
    "Is remote work more productive?",
    "Should AI development be paused?",
  ],
};

// ── Tutorial scenarios ───────────────────────────────────────────────

const TUTORIAL_SCENARIOS = [
  {
    name: "Coding Agent",
    desc: "Research before writing code",
    tab: "answer" as const,
    depth: "thorough" as const,
    query: "What's the best Python library for building WebSocket servers?",
    tutorial: "coding-agent",
  },
  {
    name: "Support Agent",
    desc: "Verify answers before responding",
    tab: "answer" as const,
    depth: "fast" as const,
    query: "How does GDPR affect data storage for SaaS products?",
    tutorial: "support-agent",
  },
  {
    name: "Content Research",
    desc: "Deep research with statistics and contradictions",
    tab: "answer" as const,
    depth: "thorough" as const,
    query: "What is the current state of AI in healthcare? Include statistics and contradictions.",
    tutorial: "content-agent",
  },
  {
    name: "Fact Check",
    desc: "Verify a claim with thorough mode",
    tab: "answer" as const,
    depth: "thorough" as const,
    query: "Did NASA confirm water on Mars in 2024?",
    tutorial: "fact-checker-bot",
  },
  {
    name: "Is This True?",
    desc: "Quick confidence check on any statement",
    tab: "answer" as const,
    depth: "fast" as const,
    query: "Drinking 8 glasses of water a day is necessary for health",
    tutorial: "is-this-true",
  },
  {
    name: "Settle a Debate",
    desc: "Compare two opposing claims",
    tab: "compare" as const,
    depth: "fast" as const,
    query: "Is remote work more productive than office work?",
    tutorial: "debate-settler",
  },
  {
    name: "Verify Docs",
    desc: "Check if a claim in documentation is accurate",
    tab: "answer" as const,
    depth: "thorough" as const,
    query: "Python is the most popular programming language in 2026",
    tutorial: "docs-verifier",
  },
  {
    name: "Research Brief",
    desc: "Deep research with contradictions",
    tab: "answer" as const,
    depth: "thorough" as const,
    query: "What are the health effects of intermittent fasting? Include any contradictions.",
    tutorial: "podcast-prep",
  },
  {
    name: "Deep Reasoning",
    desc: "Multi-step agentic research with gap analysis",
    tab: "answer" as const,
    depth: "deep" as const,
    query: "What was before the Big Bang? Compare leading cosmological theories with evidence for and against each.",
    tutorial: "deep-reasoning",
  },
  {
    name: "Deep Investigation",
    desc: "Iterative follow-up searches to fill knowledge gaps",
    tab: "answer" as const,
    depth: "deep" as const,
    query: "What is the current scientific consensus on dark matter vs modified gravity theories?",
    tutorial: "deep-investigation",
  },
];

const PLACEHOLDERS: Record<string, string> = {
  answer: "Ask a research question…",
  search: "Enter a search query…",
  open: "Enter a URL to fetch and parse…",
  extract: "Enter a URL to extract claims from…",
  compare: "Compare raw LLM vs evidence-backed…",
  verify: "Paste a document to fact-check…",
};

// ── Helpers ──────────────────────────────────────────────────────────

function confidenceBg(c: number): string {
  if (c >= 0.75) return "bg-green-400/10 border-green-400/30 text-green-400";
  if (c >= 0.55) return "bg-yellow-400/10 border-yellow-400/30 text-yellow-400";
  return "bg-red-400/10 border-red-400/30 text-red-400";
}

// ── Component ───────────────────────────────────────────────────────

const Playground = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>("answer");
  const [depth, setDepth] = useState<"fast" | "thorough" | "deep">("fast");
  const [showRawJson, setShowRawJson] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<string | null>(null);
  const [showScenarios, setShowScenarios] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [clarityEnabled, setClarityEnabled] = useState(false);
  const [clarityResult, setClarityResult] = useState<ClarityResult | null>(null);
  const [showLoginGate, setShowLoginGate] = useState(false);
  const [showApiKeyGate, setShowApiKeyGate] = useState(false);

  // Streaming state (answer tab only)
  const [streamingText, setStreamingText] = useState("");
  const [traceSteps, setTraceSteps] = useState<TraceEvent[]>([]);
  const [previewSources, setPreviewSources] = useState<SourcePreview[]>([]);
  const [streamDone, setStreamDone] = useState(false);
  const [lastQuery, setLastQuery] = useState("");

  const isStreamingTokens = loading && activeTab === "answer" && streamingText.length > 0;

  const handleStreamEvent = useCallback((event: StreamEvent) => {
    switch (event.type) {
      case "trace":
        setTraceSteps((prev) => [...prev, event.data]);
        break;
      case "sources":
        setPreviewSources(event.data);
        break;
      case "token":
        setStreamingText((prev) => prev + event.data.text);
        break;
      case "result":
        // Will be set via the promise resolution
        break;
      case "done":
        if (event.data?.quota) setQuota(event.data as any);
        setStreamDone(true);
        break;
    }
  }, []);

  const resetStreamState = () => {
    setStreamingText("");
    setTraceSteps([]);
    setPreviewSources([]);
    setStreamDone(false);
  };

  const runScenario = (scenario: typeof TUTORIAL_SCENARIOS[number]) => {
    setActiveTab(scenario.tab);
    setDepth(scenario.depth);
    setInput(scenario.query);
    setShowScenarios(false);
    setResponse(null);
    setShowRawJson(false);
    setFeedbackSent(null);
    resetStreamState();
    setTimeout(() => run(scenario.query, scenario.depth, scenario.tab), 50);
  };

  const run = async (overrideInput?: string, overrideDepth?: "fast" | "thorough" | "deep", overrideTab?: string) => {
    const q = overrideInput || input;
    const rawDepth = overrideDepth || depth;
    // Auto-downgrade deep → thorough when user can't access deep mode
    const currentDepth = isDepthBlocked(rawDepth, !!user, quota) ? "thorough" : rawDepth;
    const currentTab = overrideTab || activeTab;
    if (!q.trim()) return;
    setLoading(true);
    setResponse(null);
    setShowRawJson(false);
    setFeedbackSent(null);
    setShowLoginGate(false);
    resetStreamState();
    setClarityResult(null);
    setLastQuery(q);
    saveRecentQuery(q);

    try {
      let result;
      if (currentTab === "search") {
        result = await browseSearch(q, 5);
      } else if (currentTab === "open") {
        result = await browseOpen(q);
      } else if (currentTab === "extract") {
        result = await browseExtract(q);
      } else if (currentTab === "compare") {
        result = await browseCompare(q);
      } else if (clarityEnabled && !isClarityBlocked(!!user, quota)) {
        // Clarity mode: rewrite prompt → LLM + browse pipeline → fuse
        const clarityRes = await browseClarity(q, { verify: true });
        setClarityResult(clarityRes);
        // Map ClarityResult to answer-like response for shared display
        result = {
          answer: clarityRes.answer,
          claims: clarityRes.claims.map((c) => ({
            claim: c.claim,
            sources: c.sources || [],
            verified: c.verified,
            verificationScore: c.verificationScore,
          })),
          sources: clarityRes.sources || [],
          confidence: clarityRes.confidence,
          trace: clarityRes.trace,
          contradictions: clarityRes.contradictions,
        };
      } else {
        // Normal streaming answer
        result = await streamAnswerApi(q, currentDepth, handleStreamEvent);
      }
      setResponse(result);
    } catch (e: any) {
      if (e.message?.includes("DEMO_LIMIT_REACHED")) {
        if (user) { setShowApiKeyGate(true); } else { setShowLoginGate(true); }
      } else {
        setResponse({ error: e.message });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExample = (example: string) => {
    setInput(example);
    run(example);
  };

  const handleFollowUp = (q: string) => {
    setInput(q);
    run(q);
  };

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(response, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFeedback = async (rating: "good" | "bad" | "wrong") => {
    const resultId = response?.shareId;
    if (!resultId) return;
    try {
      await browseFeedback(resultId, rating);
      setFeedbackSent(rating);
    } catch {
      // silently fail
    }
  };

  const isAnswerResult = activeTab === "answer" && response && !response.error && response.answer;
  const isCompareResult = activeTab === "compare" && response && !response.error && response.evidence_backed;
  const isOpenResult = activeTab === "open" && response && !response.error;
  const hasShareId = response?.shareId;

  return (
    <>
    <SEO
      title="Playground — Try Evidence-Backed AI Search"
      description="Try BrowseAI Dev live. Search any topic and get evidence-backed answers with confidence scores, verified claims, and source citations."
      canonical="/playground"
    />
    <div className="min-h-screen">
      <nav className="flex items-center justify-between px-4 sm:px-8 py-5 border-b border-border relative">
        <div className="absolute inset-0 grid-bg grid-bg-fade pointer-events-none" />
        <div className="relative z-10 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <img src="/logo.svg" alt="BrowseAI Dev" className="w-4 h-4" />
            <span className="font-semibold text-sm">BrowseAI Dev</span>
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1.5" onClick={() => navigate("/sessions")}>
            <Brain className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sessions</span>
          </Button>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1.5" onClick={() => navigate("/recipes")}>
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Recipes</span>
          </Button>
          {!authLoading && (user ? <UserMenu /> : (
            <Button variant="ghost" size="sm" className="text-muted-foreground text-xs gap-1.5" onClick={() => setLoginOpen(true)}>
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Sign in</span>
            </Button>
          ))}
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        {/* Try an Example scenario */}
        <div className="relative">
          <button
            onClick={() => setShowScenarios(!showScenarios)}
            aria-haspopup="listbox"
            aria-expanded={showScenarios}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5 text-sm"
          >
            <Beaker className="w-3.5 h-3.5 text-accent bg-accent/10 rounded" />
            <span className="text-muted-foreground">Try an example</span>
            <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${showScenarios ? "rotate-180" : ""}`} />
          </button>

          {showScenarios && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              role="listbox"
              className="absolute z-20 top-12 left-0 w-full sm:w-[500px] max-w-[calc(100vw-2rem)] bg-card border border-border rounded-xl shadow-lg shadow-accent/5 overflow-hidden"
            >
              {TUTORIAL_SCENARIOS.map((scenario) => (
                <button
                  key={scenario.name}
                  role="option"
                  onClick={() => runScenario(scenario)}
                  className="w-full flex items-start gap-3 p-4 hover:bg-accent/5 transition-all duration-300 text-left border-b border-border last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{scenario.name}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5">
                        {scenario.tab === "compare" ? "compare" : scenario.depth}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{scenario.desc}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1 font-mono truncate">"{scenario.query}"</p>
                  </div>
                  <a
                    href={`https://github.com/BrowseAI-HQ/BrowseAI-Dev/tree/main/examples/${scenario.tutorial}`}
                    target="_blank"
                    rel="noopener"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-muted-foreground hover:text-accent transition-colors shrink-0 mt-1"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                  </a>
                </button>
              ))}
            </motion.div>
          )}
        </div>

        {/* Tabs + Input */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setResponse(null); setShowRawJson(false); setFeedbackSent(null); resetStreamState(); }}>
          <TabsList className="bg-secondary flex-wrap h-auto gap-1 p-1">
            {TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="font-mono text-xs">
                browse.{tab}
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map((tab) => (
            <TabsContent key={tab} value={tab}>
              {tab === "verify" ? (
                <VerifyDocumentTab />
              ) : (
              <>
              <div className="flex gap-2 mt-4">
                {tab === "answer" && isDepthBlocked(depth, !!user, quota) ? (
                  <>
                    <div
                      className="flex-1 h-12 px-4 rounded-lg bg-purple-500/5 border border-purple-500/30 flex items-center gap-2 cursor-pointer"
                      onClick={() => setLoginOpen(true)}
                    >
                      <Lock className="w-4 h-4 text-purple-400 shrink-0" />
                      <span className="text-purple-400 text-sm">Sign in to unlock Deep mode</span>
                    </div>
                    <ClarityToggle enabled={clarityEnabled} setEnabled={setClarityEnabled} quota={quota} />
                    <DepthToggle depth={depth} setDepth={setDepth} quota={quota} />
                    <Button onClick={() => setLoginOpen(true)} className="bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/30 h-12 px-5" aria-label="Sign in">
                      <LogIn className="w-4 h-4" />
                    </Button>
                  </>
                ) : tab === "answer" && clarityEnabled && isClarityBlocked(!!user, quota) ? (
                  <>
                    <div
                      className="flex-1 h-12 px-4 rounded-lg bg-amber-500/5 border border-amber-500/30 flex items-center gap-2 cursor-pointer"
                      onClick={() => setLoginOpen(true)}
                    >
                      <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-amber-400 text-sm">Clarity generates answers with reduced hallucinations — requires BAI key, sign in to unlock</span>
                    </div>
                    <ClarityToggle enabled={clarityEnabled} setEnabled={setClarityEnabled} quota={quota} />
                    <DepthToggle depth={depth} setDepth={setDepth} quota={quota} />
                    <Button onClick={() => setLoginOpen(true)} className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 h-12 px-5" aria-label="Sign in">
                      <LogIn className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    {tab === "answer" ? (
                      <SearchInput
                        value={input}
                        onChange={setInput}
                        onSubmit={(q) => run(q)}
                        placeholder={PLACEHOLDERS[tab]}
                        className="flex-1"
                      />
                    ) : (
                      <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && run()}
                        placeholder={PLACEHOLDERS[tab]}
                        aria-label="Research query"
                        className="flex-1 h-12 px-4 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm font-mono"
                      />
                    )}
                    {tab === "answer" && (
                      <>
                        <ClarityToggle enabled={clarityEnabled} setEnabled={setClarityEnabled} quota={quota} />
                        <DepthToggle depth={depth} setDepth={setDepth} quota={quota} />
                      </>
                    )}
                    <Button onClick={() => run()} disabled={loading || !input.trim()} className="bg-accent text-accent-foreground h-12 px-5" aria-label="Run query">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    </Button>
                  </>
                )}
              </div>

              {/* Example pills for non-answer tabs (answer tab has autocomplete) */}
              {tab !== "answer" && !response && !loading && EXAMPLES[tab]?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-xs text-muted-foreground py-1">Try:</span>
                  {EXAMPLES[tab].map((ex) => (
                    <button
                      key={ex}
                      onClick={() => handleExample(ex)}
                      className="px-3 py-1 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:border-accent/20 transition-all duration-300 hover:shadow-md hover:shadow-accent/5 truncate max-w-[180px] sm:max-w-[280px]"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              )}
              </>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* ── Clarity loading (no streaming) ── */}
        {activeTab === "answer" && loading && clarityEnabled && !isClarityBlocked(!!user, quota) && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="relative">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              <div className="absolute inset-0 w-8 h-8 rounded-full bg-amber-400/10 animate-ping" />
            </div>
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-medium text-amber-400 mt-3">
              Running Clarity pipeline…
            </motion.span>
            <p className="text-xs text-muted-foreground mt-1">Rewriting prompt + LLM answer + evidence verification</p>
          </div>
        )}

        {/* ── Streaming answer (tokens flowing in) ── */}
        {activeTab === "answer" && loading && !(clarityEnabled && !isClarityBlocked(!!user, quota)) && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-6">
            <div>
              {streamingText ? (
                <StreamingAnswer text={streamingText} streaming={true} />
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="relative">
                    <Loader2 className="w-8 h-8 text-accent animate-spin" />
                    <div className="absolute inset-0 w-8 h-8 rounded-full bg-accent/10 animate-ping" />
                  </div>
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm font-medium text-accent mt-3"
                  >
                    {depth === "deep" ? "Deep reasoning" : depth === "thorough" ? "Thorough analysis" : "Researching"}…
                  </motion.span>
                </div>
              )}
            </div>
            {/* Sidebar pipeline progress */}
            <div className="hidden lg:block">
              <StreamingPipeline
                steps={traceSteps}
                sources={previewSources}
                done={false}
                depth={depth}
              />
            </div>
          </div>
        )}

        {/* Non-answer loading (other tabs) */}
        {activeTab !== "answer" && loading && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-center gap-3 py-12">
            <Loader2 className="w-6 h-6 text-accent animate-spin" />
            <span className="text-sm text-muted-foreground">Loading…</span>
          </motion.div>
        )}

        {/* Login gate: shown when demo limit (1 free query) is reached */}
        {showLoginGate && !user && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-8 rounded-xl bg-card border border-border border-glow text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-accent/10 flex items-center justify-center animate-float">
              <Shield className="w-6 h-6 text-accent" />
            </div>
            <h3 className="text-lg font-semibold">Sign in to continue</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Create a free account to get 100 queries/day with premium verification, citations, and confidence scores.
            </p>
            <div className="pt-2">
              <LoginModal open={true} onOpenChange={(open) => { if (!open) { setShowLoginGate(false); navigate("/"); } }} redirectTo={window.location.href} />
            </div>
          </motion.div>
        )}

        {/* API key gate: shown when logged-in user hits demo limit without BAI key */}
        {showApiKeyGate && user && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-8 rounded-xl bg-card border border-border border-glow text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-accent/10 flex items-center justify-center animate-float">
              <Zap className="w-6 h-6 text-accent" />
            </div>
            <h3 className="text-lg font-semibold">Add an API key for unlimited access</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              You've used your free demo query. Generate a free API key to get <strong className="text-foreground">100 premium queries/day</strong> with full verification, citations, and confidence scores.
            </p>
            <div className="pt-2">
              <Button onClick={() => navigate("/dashboard#api-keys")} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                Get your free API key
              </Button>
            </div>
          </motion.div>
        )}

        {/* Error */}
        {response?.error && !showLoginGate && !showApiKeyGate && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-red-400/10 border border-red-400/30 text-sm space-y-3"
          >
            <p className="text-red-400">{response.error}</p>
          </motion.div>
        )}

        <LoginModal open={loginOpen} onOpenChange={setLoginOpen} redirectTo="/dashboard" />

        {/* ── Answer result (rich rendering) ── */}
        {isAnswerResult && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Header: confidence + trace + feedback */}
            <div className="flex items-center gap-3 flex-wrap">
              <Badge className={`${confidenceBg(response.confidence)} text-sm px-3 py-1`}>
                {(response.confidence * 100).toFixed(0)}% confidence
              </Badge>
              <span className="text-xs text-muted-foreground">
                {response.sources?.length || 0} sources · {response.claims?.length || 0} claims
                {response.contradictions?.length > 0 && ` · ${response.contradictions.length} contradictions`}
              </span>
              {response.trace && (
                <span className="text-xs text-muted-foreground">
                  {response.trace.reduce((s: number, t: any) => s + t.duration_ms, 0)}ms
                </span>
              )}
              {quota && (
                <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${quota.premiumActive ? "text-emerald-400 border-emerald-500/30" : "text-amber-400 border-amber-500/30"}`}>
                  {quota.premiumActive ? "Premium" : "Standard"} · {quota.used}/{quota.limit}
                </Badge>
              )}
              {hasShareId && (
                <div className="flex items-center gap-1 ml-auto">
                  {feedbackSent ? (
                    <span className="text-xs text-accent">Feedback sent</span>
                  ) : (
                    <>
                      <button onClick={() => handleFeedback("good")} className="p-1.5 rounded hover:bg-green-400/10 text-muted-foreground hover:text-green-400 transition-colors" title="Good result">
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleFeedback("bad")} className="p-1.5 rounded hover:bg-red-400/10 text-muted-foreground hover:text-red-400 transition-colors" title="Bad result">
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Answer text */}
            <div className="p-4 rounded-xl bg-card border border-border hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5 text-sm leading-relaxed">
              {response.answer}
            </div>

            {/* Clarity Improvement — how clarity reduced hallucinations */}
            {clarityResult && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider">How Clarity Improved This Answer</h3>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                    clarityResult.confidence >= 0.75 ? "text-green-400 border-green-500/30" :
                    clarityResult.confidence >= 0.55 ? "text-yellow-400 border-yellow-500/30" :
                    "text-red-400 border-red-500/30"
                  }`}>
                    {Math.round(clarityResult.confidence * 100)}% confidence
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Clarity rewrote your query with anti-hallucination techniques, generated an LLM answer, then fused it with evidence from real sources. Claims confirmed by both LLM and sources are trustworthy. LLM-only claims had no source backing and were flagged.
                </p>
                {(() => {
                  const confirmed = clarityResult.claims.filter(c => c.origin === "confirmed");
                  const llmOnly = clarityResult.claims.filter(c => c.origin === "llm");
                  const sourceOnly = clarityResult.claims.filter(c => c.origin === "source");
                  return (
                    <>
                      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                        <div className="p-2 sm:p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-center">
                          <p className="text-base sm:text-lg font-semibold text-emerald-400">{confirmed.length}</p>
                          <p className="text-[10px] text-muted-foreground">Confirmed</p>
                          <p className="text-[9px] text-emerald-400/50 hidden sm:block">LLM + sources agree</p>
                        </div>
                        <div className="p-2 sm:p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-center">
                          <p className="text-base sm:text-lg font-semibold text-amber-400">{llmOnly.length}</p>
                          <p className="text-[10px] text-muted-foreground">LLM-only</p>
                          <p className="text-[9px] text-amber-400/50 hidden sm:block">No source backing</p>
                        </div>
                        <div className="p-2 sm:p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20 text-center">
                          <p className="text-base sm:text-lg font-semibold text-blue-400">{sourceOnly.length}</p>
                          <p className="text-[10px] text-muted-foreground">Source-only</p>
                          <p className="text-[9px] text-blue-400/50 hidden sm:block">Evidence found</p>
                        </div>
                      </div>
                      {/* Techniques used */}
                      <div className="flex flex-wrap gap-1.5">
                        {clarityResult.techniques.map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px] px-2 py-0.5 text-muted-foreground">
                            {t.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                      {/* Risks identified */}
                      {clarityResult.risks && clarityResult.risks.length > 0 && (
                        <div className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/20">
                          <p className="text-[10px] font-semibold text-red-400 uppercase mb-1">Hallucination Risks Detected</p>
                          {clarityResult.risks.map((r, i) => (
                            <p key={i} className="text-[11px] text-red-400/70">• {r}</p>
                          ))}
                        </div>
                      )}
                      {/* LLM-only claims warning */}
                      {llmOnly.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold text-amber-400 uppercase">Unconfirmed Claims ({llmOnly.length})</p>
                          {llmOnly.map((c, i) => (
                            <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/20 text-[11px]">
                              <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                              <span className="text-muted-foreground">{c.claim}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Confirmed claims */}
                      {confirmed.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold text-emerald-400 uppercase">Confirmed Claims ({confirmed.length})</p>
                          {confirmed.map((c, i) => (
                            <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-[11px]">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                              <span className="text-muted-foreground">{c.claim}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* Claims */}
            {response.claims?.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Verified Claims</h3>
                {response.claims.map((claim: BrowseClaim, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-card border border-border hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5 flex gap-3">
                    <div className="shrink-0 mt-0.5">
                      {claim.verified ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{claim.claim}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {claim.consensusLevel && (
                          <span className={`text-xs ${claim.consensusLevel === "strong" ? "text-green-400" : claim.consensusLevel === "moderate" ? "text-yellow-400" : "text-muted-foreground"}`}>
                            {claim.consensusLevel} consensus
                          </span>
                        )}
                        {claim.sources?.length > 0 && (
                          <span className="text-xs text-muted-foreground">{claim.sources.length} sources</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Contradictions */}
            {response.contradictions?.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                  Contradictions
                </h3>
                {response.contradictions.map((c: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-yellow-400/5 border border-yellow-400/20 text-sm space-y-1">
                    <p className="text-xs text-yellow-400">Topic: {c.topic}</p>
                    <p>A: {c.claimA}</p>
                    <p>B: {c.claimB}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Sources */}
            {response.sources?.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sources</h3>
                <div className="grid gap-2">
                  {response.sources.slice(0, 8).map((src: BrowseSource, i: number) => (
                    <a
                      key={i}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-lg bg-card border border-border hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5 flex gap-3 group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate group-hover:text-accent transition-colors">{src.title}</span>
                          <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Globe className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{src.domain}</span>
                          {src.verified && <CheckCircle2 className="w-3 h-3 text-green-400" />}
                          {src.authority != null && (
                            <span className={`text-xs ${src.authority >= 0.8 ? "text-green-400" : src.authority >= 0.5 ? "text-yellow-400" : "text-muted-foreground"}`}>
                              authority: {(src.authority * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                        {src.quote && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">"{src.quote}"</p>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Follow-up suggestions */}
            <FollowUpSuggestions
              query={lastQuery || input}
              answer={response.answer}
              claims={response.claims}
              contradictions={response.contradictions}
              onSelect={handleFollowUp}
            />

            {/* Pipeline trace */}
            {response.trace?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {response.trace.map((t: any, i: number) => (
                  <span key={i} className="text-xs text-muted-foreground bg-accent/5 border border-accent/10 px-2 py-1 rounded">
                    {t.step}: {t.duration_ms}ms
                  </span>
                ))}
              </div>
            )}

            {/* Legal disclaimer */}
            <p className="text-[10px] text-muted-foreground/50 text-center leading-relaxed pt-2">
              AI-generated research for informational purposes only. Confidence scores are algorithmic estimates, not guarantees.{" "}
              <a href="/terms" className="underline hover:text-muted-foreground transition-colors">Terms</a>
            </p>
          </motion.div>
        )}

        {/* ── Open result (page content) ── */}
        {isOpenResult && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {response.title && <h3 className="text-sm font-semibold">{response.title}</h3>}
            {response.url && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Globe className="w-3 h-3" />
                <a href={response.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">{response.url}</a>
              </div>
            )}
            {response.text && (
              <div className="px-2 sm:px-4 py-4 rounded-xl bg-card border border-border hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5 text-sm leading-relaxed max-h-[500px] overflow-y-auto whitespace-pre-wrap">
                {response.text.slice(0, 5000)}{response.text.length > 5000 && "…"}
              </div>
            )}
            {response.wordCount != null && (
              <span className="text-xs text-muted-foreground">{response.wordCount.toLocaleString()} words extracted</span>
            )}
          </motion.div>
        )}

        {/* ── Compare result ── */}
        {isCompareResult && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-card border border-border hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">Raw LLM</Badge>
                  <span className="text-xs text-muted-foreground">
                    {response.raw_llm.sources} sources · {response.raw_llm.claims} claims
                  </span>
                </div>
                <p className="text-sm leading-relaxed line-clamp-[12]">{response.raw_llm.answer}</p>
                <p className="text-xs text-muted-foreground">No confidence score — LLM cannot self-assess accuracy</p>
              </div>
              <div className="p-4 rounded-xl bg-card border border-accent/30 border-glow hover:shadow-lg hover:shadow-accent/5 transition-all duration-300 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className={`${confidenceBg(response.evidence_backed.confidence)} text-xs`}>
                    {(response.evidence_backed.confidence * 100).toFixed(0)}% confidence
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {response.evidence_backed.sources} sources · {response.evidence_backed.claims} claims
                  </span>
                </div>
                <p className="text-sm leading-relaxed line-clamp-[12]">{response.evidence_backed.answer}</p>
                {response.evidence_backed.claimDetails?.slice(0, 3).map((claim: BrowseClaim, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    {claim.verified ? (
                      <CheckCircle2 className="w-3 h-3 text-green-400 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                    )}
                    <span className="text-muted-foreground">{claim.claim}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Raw JSON toggle ── */}
        {response && !response.error && (
          <div className="space-y-2">
            <button
              onClick={() => setShowRawJson(!showRawJson)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Code2 className="w-3.5 h-3.5" />
              {showRawJson ? "Hide" : "Show"} raw JSON
              {showRawJson ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {(showRawJson || (!isAnswerResult && !isCompareResult && !isOpenResult)) && (
              <div className="relative">
                <button
                  onClick={copyJson}
                  className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors z-10"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <pre className="px-2 sm:px-5 py-5 rounded-xl bg-card border border-border hover:border-accent/20 transition-all duration-300 overflow-x-auto text-xs font-mono text-secondary-foreground leading-relaxed max-h-[500px] overflow-y-auto">
                  {JSON.stringify(response, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* ── Empty state: feature overview ── */}
        {!response && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              {[
                { tab: "answer", label: "Full Pipeline", desc: "Search → extract → verify → cite with confidence score" },
                { tab: "search", label: "Web Search", desc: "Search the web and get ranked results" },
                { tab: "open", label: "Page Parser", desc: "Fetch any URL and get clean parsed text" },
                { tab: "extract", label: "Claim Extraction", desc: "Extract structured claims from any page" },
                { tab: "compare", label: "Raw vs Evidence", desc: "Side-by-side: raw LLM vs evidence-backed answer" },
                { tab: "sessions", label: "Research Sessions", desc: "Multi-query sessions with persistent memory", link: "/sessions" },
              ].map((item, idx) => (
                <motion.button
                  key={item.tab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + idx * 0.07 }}
                  onClick={() => item.link ? navigate(item.link) : setActiveTab(item.tab)}
                  className="p-4 rounded-xl bg-card border border-border hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5 text-left group"
                >
                  <p className="text-sm font-medium group-hover:text-accent transition-colors">
                    {item.label}
                    {item.link && <ExternalLink className="w-3 h-3 inline ml-1.5 opacity-50" />}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
    </>
  );
};

export default Playground;
