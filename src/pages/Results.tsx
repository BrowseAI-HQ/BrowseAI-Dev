import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Share2, GitCompare, Check, Zap, Brain, Shield, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BrowseResult, ClarityResult } from "@/lib/api/browse";
import { browseClarity } from "@/lib/api/browse";
import { streamAnswer, type TraceEvent, type SourcePreview, type StreamEvent, type PremiumQuota } from "@/lib/api/stream";
import { StreamingAnswer } from "@/components/results/StreamingAnswer";
import { FinalAnswer } from "@/components/results/FinalAnswer";
import { EvidenceGraph } from "@/components/results/EvidenceGraph";
import { TracePipeline } from "@/components/results/TracePipeline";
import { AgentJson } from "@/components/results/AgentJson";
import { StreamingPipeline } from "@/components/results/StreamingPipeline";
import { FollowUpSuggestions } from "@/components/FollowUpSuggestions";
import { SearchInput, saveRecentQuery } from "@/components/SearchInput";
import { BrowseBadge } from "@/components/BrowseBadge";
import { LoginModal } from "@/components/LoginModal";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/contexts/AuthContext";
import { DepthToggle, isDepthBlocked, formatResetTime } from "@/components/DepthToggle";
import { ClarityToggle, isClarityBlocked } from "@/components/ClarityToggle";

const Results = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get("q") || "";
  const rawDepth = (searchParams.get("depth") as "fast" | "thorough" | "deep") || "fast";
  const clarityFromUrl = searchParams.get("clarity") === "true";
  const [result, setResult] = useState<BrowseResult | null>(null);
  const [clarityResult, setClarityResult] = useState<ClarityResult | null>(null);
  const [clarityLoading, setClarityLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const { user, loading: authLoading } = useAuth();

  // Auto-downgrade deep → thorough when user can't access deep mode
  const depth = isDepthBlocked(rawDepth, !!user, null) ? "thorough" : rawDepth;

  // Streaming state
  const [traceSteps, setTraceSteps] = useState<TraceEvent[]>([]);
  const [previewSources, setPreviewSources] = useState<SourcePreview[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [streamDone, setStreamDone] = useState(false);
  const [quota, setQuota] = useState<PremiumQuota | null>(null);
  const [effectiveDepth, setEffectiveDepth] = useState(depth);
  const [reasoningSteps, setReasoningSteps] = useState<any[]>([]);

  // Follow-up search bar state
  const [followUpInput, setFollowUpInput] = useState("");
  const [followUpDepth, setFollowUpDepth] = useState(depth);

  // Track whether we're in the "streaming tokens" phase
  const isStreamingTokens = loading && streamingText.length > 0;

  const handleStreamEvent = (event: StreamEvent) => {
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
      case "reasoning_step":
        setReasoningSteps((prev) => [...prev, event.data]);
        break;
      case "result":
        setResult(event.data);
        break;
      case "done":
        if (event.data?.quota) setQuota(event.data.quota);
        if (event.data?.effectiveDepth) setEffectiveDepth(event.data.effectiveDepth as "fast" | "thorough" | "deep");
        setStreamDone(true);
        break;
    }
  };

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setClarityResult(null);
    setStreamingText("");
    setTraceSteps([]);
    setPreviewSources([]);
    setReasoningSteps([]);
    setStreamDone(false);
    saveRecentQuery(query);

    // Run clarity in parallel if enabled
    if (clarityFromUrl && !isClarityBlocked(!!user, null)) {
      setClarityLoading(true);
      browseClarity(query, { verify: false }).then(setClarityResult).catch(() => {}).finally(() => setClarityLoading(false));
    }

    streamAnswer(query, depth, handleStreamEvent)
      .then((res) => {
        setResult(res);
        setStreamDone(true);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [query, depth]);

  const handleShare = () => {
    if (!result?.shareId) return;
    const url = `${window.location.origin}/share/${result.shareId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFollowUp = (q: string) => {
    const effectiveFollowUpDepth = isDepthBlocked(followUpDepth, !!user, quota) ? "thorough" : followUpDepth;
    const depthParam = effectiveFollowUpDepth !== "fast" ? effectiveFollowUpDepth : undefined;
    setSearchParams({ q, ...(depthParam && { depth: depthParam }) });
    setFollowUpInput("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <nav className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <img src="/logo.svg" alt="BrowseAI Dev" className="w-4 h-4" />
            <span className="font-semibold text-sm hidden sm:inline">BrowseAI Dev</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <>
              <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleShare}>
                {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{copied ? "Copied!" : "Share"}</span>
              </Button>
              <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => navigate(`/compare?q=${encodeURIComponent(query)}`)}>
                <GitCompare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Compare</span>
              </Button>
            </>
          )}
          {quota && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${quota.premiumActive ? "text-emerald-400 border-emerald-500/30" : "text-amber-400 border-amber-500/30"}`}>
              <Zap className="w-3 h-3 inline mr-0.5" />
              {quota.premiumActive ? "Premium" : "Standard"} · {quota.used}/{quota.limit}
            </span>
          )}
          {!authLoading && (user ? <UserMenu /> : <LoginModal />)}
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Query display */}
        <div className="flex items-center gap-2">
          <p className="text-lg font-medium text-foreground">
            {query}
          </p>
          {depth !== "fast" && (
            <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">
              {depth}
            </Badge>
          )}
          {clarityFromUrl && (
            <Badge variant="outline" className="text-[10px] px-1.5 shrink-0 text-amber-400 border-amber-500/30">
              <Shield className="w-2.5 h-2.5 mr-0.5 inline" />
              clarity
            </Badge>
          )}
        </div>

        {/* Layout: answer on left, pipeline on right (desktop) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
          {/* Main content column */}
          <div className="space-y-8 min-w-0">
            {/* Streaming answer (shows tokens as they arrive) */}
            {isStreamingTokens && (
              <StreamingAnswer
                text={streamingText}
                streaming={true}
              />
            )}

            {/* Final answer (once result is ready) */}
            {result && !loading && (
              <FinalAnswer answer={result.answer} confidence={result.confidence} />
            )}

            {/* Depth fallback notice */}
            {!loading && depth === "deep" && effectiveDepth !== "deep" && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono"
              >
                <Zap className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Ran in <strong>standard mode</strong> (thorough) — deep mode
                  {user ? ` quota exhausted, resets in ${formatResetTime(quota?.resetsInSeconds)}` : " requires sign in"}
                </span>
              </motion.div>
            )}

            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-center">
                {error}
              </motion.div>
            )}

            {/* Deep reasoning steps */}
            {(() => {
              const steps = result?.reasoningSteps?.length ? result.reasoningSteps : reasoningSteps;
              return steps.length > 0 ? (
                <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5 text-purple-400" />
                    Deep Reasoning ({steps.length} step{steps.length !== 1 ? "s" : ""})
                    {loading && <span className="animate-pulse text-purple-400/60">…</span>}
                  </h3>
                  <div className="space-y-2">
                    {steps.map((rs: any, i: number) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="p-3 rounded-lg bg-purple-400/5 border border-purple-400/20 text-sm space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] px-1.5 border-purple-400/30 text-purple-400">Step {rs.step}</Badge>
                          <span className="text-xs text-muted-foreground">{rs.claimCount} claims · {Math.round(rs.confidence * 100)}% confidence</span>
                        </div>
                        <p className="text-xs font-mono text-muted-foreground">"{rs.query}"</p>
                        {rs.gapAnalysis && rs.gapAnalysis !== "Initial research pass" && (
                          <p className="text-xs text-muted-foreground/70">Gap: {rs.gapAnalysis}</p>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </motion.section>
              ) : null;
            })()}

            {/* Clarity — Anti-Hallucination Prompts */}
            {(clarityResult || clarityLoading) && !loading && (
              <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Clarity</h3>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-400/60 border-amber-500/20">beta</Badge>
                  {clarityLoading && <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Anti-hallucination prompt engineering — analyzes your query, detects hallucination risks, and rewrites it with grounding techniques (chain-of-verification, quote extraction, source attribution). When agents are empowered with Clarity, they automatically get rewritten prompts that instruct LLMs to cite sources, flag uncertainty, and verify claims before responding — reducing hallucinations without changing your workflow. Copy these into your own LLM calls or let your agent use them directly. Experimental — results may vary.
                </p>
                {clarityResult && (
                  <>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5 text-amber-400 border-amber-500/30">
                        {clarityResult.intent}
                      </Badge>
                      {clarityResult.techniques.map((t) => (
                        <Badge key={t} variant="outline" className="text-[10px] px-2 py-0.5 text-muted-foreground">
                          {t.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                    <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                      <p className="text-[10px] font-semibold text-amber-400 uppercase mb-1">System Prompt</p>
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">{clarityResult.systemPrompt}</pre>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                      <p className="text-[10px] font-semibold text-amber-400 uppercase mb-1">Clarity User Prompt</p>
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{clarityResult.userPrompt}</pre>
                    </div>
                  </>
                )}
              </motion.section>
            )}

            {/* Evidence + trace (after result) */}
            {result && !loading && (
              <>
                <EvidenceGraph claims={result.claims} sources={result.sources} contradictions={result.contradictions} />

                {/* Follow-up suggestions */}
                <FollowUpSuggestions
                  query={query}
                  answer={result.answer}
                  claims={result.claims}
                  contradictions={result.contradictions}
                  onSelect={handleFollowUp}
                />

                {/* Follow-up search bar */}
                <div className="flex gap-2">
                  <SearchInput
                    value={followUpInput}
                    onChange={setFollowUpInput}
                    onSubmit={handleFollowUp}
                    placeholder="Ask a follow-up question…"
                    className="flex-1"
                  />
                  <DepthToggle depth={followUpDepth} setDepth={setFollowUpDepth} quota={quota} />
                  <Button onClick={() => handleFollowUp(followUpInput)} disabled={!followUpInput.trim()} className="bg-accent text-accent-foreground h-12 px-5">
                    Ask
                  </Button>
                </div>

                <TracePipeline trace={result.trace} />
                <AgentJson result={result} />
                <div className="flex justify-center pt-4">
                  <BrowseBadge />
                </div>
              </>
            )}
          </div>

          {/* Sidebar: pipeline progress + sources (during streaming) */}
          {loading && (
            <div className="hidden lg:block">
              <div className="sticky top-8">
                <StreamingPipeline
                  steps={traceSteps}
                  sources={previewSources}
                  done={false}
                  depth={depth}
                />
              </div>
            </div>
          )}

          {/* Mobile: show pipeline inline above answer */}
          {loading && !isStreamingTokens && (
            <div className="lg:hidden">
              <StreamingPipeline
                steps={traceSteps}
                sources={previewSources}
                done={false}
                depth={depth}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Results;
