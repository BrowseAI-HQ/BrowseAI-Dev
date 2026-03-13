import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Play, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Shield, Globe, Copy, Check, Code2, ChevronDown, ChevronUp,
  GitCompare, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  browseKnowledge, browseSearch, browseExtract, browseCompare,
  type BrowseResult, type BrowseSource, type BrowseClaim, type CompareResult,
} from "@/lib/api/browse";
import { LoginModal } from "@/components/LoginModal";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/contexts/AuthContext";

// ── Example queries per tab ─────────────────────────────────────────

const EXAMPLES: Record<string, string[]> = {
  search: [
    "AI safety regulations 2024",
    "CRISPR clinical trials results",
    "quantum computing breakthroughs",
  ],
  extract: [
    "https://en.wikipedia.org/wiki/Large_language_model",
    "https://arxiv.org/abs/2303.08774",
  ],
  answer: [
    "How do mRNA vaccines work?",
    "Is nuclear energy safe for climate?",
    "How does RAG improve LLM accuracy?",
  ],
  compare: [
    "What are the health effects of intermittent fasting?",
    "Is remote work more productive than office work?",
    "Should AI development be paused?",
  ],
};

// ── Agent use-case snippets ─────────────────────────────────────────

const AGENT_SNIPPETS = [
  {
    title: "Research Agent",
    desc: "Multi-step research with persistent memory",
    code: `from browseai import BrowseAI

client = BrowseAI()

# Create a research session
session = client.create_session(topic="AI Safety")

# Ask multiple questions — each builds on prior knowledge
r1 = session.ask("What is RLHF?")
r2 = session.ask("How does constitutional AI differ?")
r3 = session.ask("What are the open problems?")

# Export accumulated knowledge
knowledge = session.knowledge()
print(f"{len(knowledge.claims)} verified claims across {len(knowledge.sources)} sources")`,
  },
  {
    title: "Fact-Checker Agent",
    desc: "Verify claims and detect contradictions",
    code: `result = client.answer(
  "Is organic food healthier than conventional?",
  depth="thorough"
)

print(f"Confidence: {result.confidence:.0%}")

for claim in result.claims:
  status = "Verified" if claim.verified else "Unverified"
  print(f"  [{status}] {claim.claim}")
  print(f"    Consensus: {claim.consensus_level} ({claim.consensus_count} sources)")

if result.contradictions:
  print(f"\\nContradictions found:")
  for c in result.contradictions:
    print(f"  {c.claim_a} vs {c.claim_b}")`,
  },
  {
    title: "Competitive Analysis",
    desc: "Compare raw LLM vs evidence-backed answers",
    code: `comparison = client.compare("How does React compare to Vue.js?")

print(f"Raw LLM: {comparison.raw_llm.sources} sources, no confidence")
print(f"Evidence-backed: {comparison.evidence_backed.sources} sources, "
      f"{comparison.evidence_backed.confidence:.0%} confidence")

# Evidence-backed answer includes verified claims
for claim in comparison.evidence_backed.claim_details:
  print(f"  [{claim.consensus_level}] {claim.claim}")`,
  },
];

// ── Confidence color helper ─────────────────────────────────────────

function confidenceColor(c: number): string {
  if (c >= 0.75) return "text-green-400";
  if (c >= 0.55) return "text-yellow-400";
  return "text-red-400";
}

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
  const [activeTab, setActiveTab] = useState("answer");
  const [depth, setDepth] = useState<"fast" | "thorough">("fast");
  const [showRawJson, setShowRawJson] = useState(false);
  const [copied, setCopied] = useState(false);

  const run = async (overrideInput?: string) => {
    const q = overrideInput || input;
    if (!q.trim()) return;
    setLoading(true);
    setResponse(null);
    setShowRawJson(false);
    try {
      let result;
      if (activeTab === "search") {
        result = await browseSearch(q, 5);
      } else if (activeTab === "extract") {
        result = await browseExtract(q);
      } else if (activeTab === "compare") {
        result = await browseCompare(q);
      } else {
        result = await browseKnowledge(q, depth);
      }
      setResponse(result);
    } catch (e: any) {
      setResponse({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleExample = (example: string) => {
    setInput(example);
    run(example);
  };

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(response, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const placeholders: Record<string, string> = {
    search: "Enter a search query…",
    extract: "Enter a URL to extract from…",
    answer: "Ask a research question…",
    compare: "Ask a question to compare raw vs evidence-backed…",
  };

  const isAnswerResult = activeTab === "answer" && response && !response.error && response.answer;
  const isCompareResult = activeTab === "compare" && response && !response.error && response.evidence_backed;

  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between px-4 sm:px-8 py-5 border-b border-border">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="BrowseAI" className="w-4 h-4" />
            <span className="font-semibold text-sm">Playground</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!authLoading && (user ? <UserMenu /> : <LoginModal />)}
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        {/* Tabs + Input */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setResponse(null); setShowRawJson(false); }}>
          <TabsList className="bg-secondary">
            <TabsTrigger value="answer" className="font-mono text-xs">browse.answer</TabsTrigger>
            <TabsTrigger value="search" className="font-mono text-xs">browse.search</TabsTrigger>
            <TabsTrigger value="extract" className="font-mono text-xs">browse.extract</TabsTrigger>
            <TabsTrigger value="compare" className="font-mono text-xs">browse.compare</TabsTrigger>
          </TabsList>

          {["answer", "search", "extract", "compare"].map((tab) => (
            <TabsContent key={tab} value={tab}>
              <div className="flex gap-2 mt-4">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && run()}
                  placeholder={placeholders[tab]}
                  className="flex-1 h-12 px-4 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm font-mono"
                />
                {tab === "answer" && (
                  <button
                    onClick={() => setDepth(depth === "fast" ? "thorough" : "fast")}
                    className={`h-12 px-3 rounded-lg border text-xs font-mono transition-colors ${depth === "thorough" ? "bg-accent/10 border-accent/40 text-accent" : "bg-secondary border-border text-muted-foreground hover:text-foreground"}`}
                  >
                    {depth === "thorough" ? "Thorough" : "Fast"}
                  </button>
                )}
                <Button onClick={() => run()} disabled={loading || !input.trim()} className="bg-accent text-accent-foreground h-12 px-5">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                </Button>
              </div>

              {/* Example pills */}
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-xs text-muted-foreground py-1">Try:</span>
                {EXAMPLES[tab]?.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => handleExample(ex)}
                    className="px-3 py-1 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:border-accent/40 transition-all truncate max-w-[280px]"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Running pipeline…</span>
          </div>
        )}

        {/* Error */}
        {response?.error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-red-400/10 border border-red-400/30 text-red-400 text-sm"
          >
            {response.error}
          </motion.div>
        )}

        {/* ── Answer result (rich rendering) ── */}
        {isAnswerResult && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Header: confidence + trace */}
            <div className="flex items-center gap-3 flex-wrap">
              <Badge className={`${confidenceBg(response.confidence)} text-sm px-3 py-1`}>
                {(response.confidence * 100).toFixed(0)}% confidence
              </Badge>
              <span className="text-xs text-muted-foreground">
                {response.sources?.length || 0} sources · {response.claims?.length || 0} claims
                {response.contradictions?.length > 0 && ` · ${response.contradictions.length} contradictions`}
              </span>
              {response.trace && (
                <span className="text-xs text-muted-foreground ml-auto">
                  {response.trace.reduce((s: number, t: any) => s + t.duration_ms, 0)}ms total
                </span>
              )}
            </div>

            {/* Answer text */}
            <div className="p-4 rounded-xl bg-card border border-border text-sm leading-relaxed">
              {response.answer}
            </div>

            {/* Claims */}
            {response.claims?.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Verified Claims</h3>
                {response.claims.map((claim: BrowseClaim, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-card border border-border flex gap-3">
                    <div className="shrink-0 mt-0.5">
                      {claim.verified ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-muted-foreground" />
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
                      className="p-3 rounded-lg bg-card border border-border hover:border-accent/40 transition-colors flex gap-3 group"
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

            {/* Pipeline trace */}
            {response.trace?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {response.trace.map((t: any, i: number) => (
                  <span key={i} className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                    {t.step}: {t.duration_ms}ms
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Compare result ── */}
        {isCompareResult && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Raw LLM */}
              <div className="p-4 rounded-xl bg-card border border-border space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">Raw LLM</Badge>
                  <span className="text-xs text-muted-foreground">
                    {response.raw_llm.sources} sources · {response.raw_llm.claims} claims
                  </span>
                </div>
                <p className="text-sm leading-relaxed line-clamp-[12]">{response.raw_llm.answer}</p>
                <p className="text-xs text-muted-foreground">No confidence score — LLM cannot self-assess accuracy</p>
              </div>

              {/* Evidence-backed */}
              <div className="p-4 rounded-xl bg-card border border-accent/30 space-y-3">
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

        {/* ── Fallback: raw JSON for search/extract or toggle ── */}
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

            {(showRawJson || (!isAnswerResult && !isCompareResult)) && (
              <div className="relative">
                <button
                  onClick={copyJson}
                  className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors z-10"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <pre className="p-5 rounded-xl bg-card border border-border overflow-x-auto text-xs font-mono text-secondary-foreground leading-relaxed max-h-[500px] overflow-y-auto">
                  {JSON.stringify(response, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* ── Agent Use Cases (shown when no response) ── */}
        {!response && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="space-y-6 pt-4">
            <div className="text-center space-y-2">
              <h2 className="text-lg font-semibold">How Agents Use BrowseAI</h2>
              <p className="text-sm text-muted-foreground">Copy these patterns into your agent code</p>
            </div>

            <div className="grid gap-4">
              {AGENT_SNIPPETS.map((snippet) => (
                <AgentSnippet key={snippet.title} {...snippet} />
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

// ── Agent snippet component ─────────────────────────────────────────

function AgentSnippet({ title, desc, code }: { title: string; desc: string; code: string }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Code2 className="w-4 h-4 text-accent" />
          <div className="text-left">
            <span className="text-sm font-medium">{title}</span>
            <span className="text-xs text-muted-foreground ml-2">{desc}</span>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="relative border-t border-border">
          <button
            onClick={copyCode}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors z-10"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <pre className="p-4 overflow-x-auto text-xs font-mono text-secondary-foreground leading-relaxed">
            {code}
          </pre>
        </div>
      )}
    </div>
  );
}

export default Playground;
