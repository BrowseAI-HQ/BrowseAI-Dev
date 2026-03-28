import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Share2, GitCompare, Check, Zap, Brain, Shield, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BrowseResult } from "@/lib/api/browse";
import { browseClarity, type ClarityResult } from "@/lib/api/browse";
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

const Results = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get("q") || "";
  const rawDepth = (searchParams.get("depth") as "fast" | "thorough" | "deep") || "fast";
  const clarityFromUrl = searchParams.get("clarity") === "true";
  const [result, setResult] = useState<BrowseResult | null>(null);
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

  // Clarity result (when clarity mode is on)
  const [clarityData, setClarityData] = useState<ClarityResult | null>(null);

  // Login gate: show modal when demo limit is reached
  const [showLoginGate, setShowLoginGate] = useState(false);

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

  // When user logs in after hitting demo limit, dismiss the gate and retry
  useEffect(() => {
    if (user && showLoginGate) {
      setShowLoginGate(false);
      // Trigger re-fetch by updating a dependency — navigate to same URL to re-run the query effect
      window.location.reload();
    }
  }, [user, showLoginGate]);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setClarityData(null);
    setShowLoginGate(false);
    setStreamingText("");
    setTraceSteps([]);
    setPreviewSources([]);
    setReasoningSteps([]);
    setStreamDone(false);
    saveRecentQuery(query);

    if (clarityFromUrl) {
      // Clarity mode: rewrite prompt → LLM + browse pipeline → fuse
      browseClarity(query, { verify: true })
        .then((clarityRes) => {
          setClarityData(clarityRes);
          // Map ClarityResult to BrowseResult for shared components
          setResult({
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
          });
          setStreamDone(true);
        })
        .catch((e) => {
          if (e.message?.includes("DEMO_LIMIT_REACHED")) {
            setShowLoginGate(true);
          } else {
            setError(e.message);
          }
        })
        .finally(() => setLoading(false));
    } else {
      // Normal streaming answer
      streamAnswer(query, depth, handleStreamEvent)
        .then((res) => {
          setResult(res);
          setStreamDone(true);
        })
        .catch((e) => {
          if (e.message?.includes("DEMO_LIMIT_REACHED")) {
            setShowLoginGate(true);
          } else {
            setError(e.message);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [query, depth, clarityFromUrl]);

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
      <nav className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-border transition-colors duration-300">
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
              <Button variant="outline" size="sm" className="text-xs gap-1.5 transition-all duration-300 hover:border-accent/20 hover:shadow-lg hover:shadow-accent/5" onClick={handleShare}>
                {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{copied ? "Copied!" : "Share"}</span>
              </Button>
              <Button variant="outline" size="sm" className="text-xs gap-1.5 transition-all duration-300 hover:border-accent/20 hover:shadow-lg hover:shadow-accent/5" onClick={() => navigate(`/compare?q=${encodeURIComponent(query)}`)}>
                <GitCompare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Compare</span>
              </Button>
            </>
          )}
          {quota && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono transition-all duration-300 ${quota.premiumActive ? "text-emerald-400 border-emerald-500/30" : "text-amber-400 border-amber-500/30"}`}>
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
            {/* Clarity loading indicator (no streaming for clarity mode) */}
            {loading && clarityFromUrl && !result && (
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

            {/* Mobile: loading spinner before tokens arrive */}
            {loading && !clarityFromUrl && !isStreamingTokens && (
              <div className="flex flex-col items-center justify-center py-8 lg:hidden">
                <div className="relative">
                  <Loader2 className="w-8 h-8 text-accent animate-spin" />
                  <div className="absolute inset-0 w-8 h-8 rounded-full bg-accent/10 animate-ping" />
                </div>
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-medium text-accent mt-3">
                  {depth === "deep" ? "Deep reasoning" : depth === "thorough" ? "Thorough analysis" : "Researching"}…
                </motion.span>
              </div>
            )}

            {/* Streaming answer (shows tokens as they arrive) */}
            {isStreamingTokens && !clarityFromUrl && (
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
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono transition-all duration-300 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5"
              >
                <Zap className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Ran in <strong>standard mode</strong> (thorough) — deep mode
                  {user ? ` quota exhausted, resets in ${formatResetTime(quota?.resetsInSeconds)}` : " requires sign in"}
                </span>
              </motion.div>
            )}

            {/* Login gate: shown when demo limit (1 free query) is reached */}
            {showLoginGate && !user && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-8 rounded-xl bg-card border border-border text-center space-y-4 transition-all duration-300 hover:border-accent/20 hover:shadow-lg hover:shadow-accent/5">
                <div className="w-12 h-12 mx-auto rounded-full bg-accent/10 flex items-center justify-center glow-pulse">
                  <Shield className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-lg font-semibold">Sign in to continue</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Create a free account to get 100 queries/day with premium verification, citations, and confidence scores.
                </p>
                <div className="pt-2">
                  <LoginModal open={true} onOpenChange={(open) => { if (!open) { setShowLoginGate(false); navigate("/"); } }} redirectTo="/dashboard#api-keys" />
                </div>
              </motion.div>
            )}

            {error && !showLoginGate && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-center transition-all duration-300 hover:border-destructive/30 hover:shadow-lg hover:shadow-destructive/5">
                {error}
              </motion.div>
            )}

            {/* Deep reasoning steps */}
            {(() => {
              const steps = result?.reasoningSteps?.length ? result.reasoningSteps : reasoningSteps;
              return steps.length > 0 ? (
                <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5 text-purple-400" />
                    Deep Reasoning ({steps.length} step{steps.length !== 1 ? "s" : ""})
                    {loading && <span className="animate-pulse text-purple-400/60">…</span>}
                  </h3>
                  <div className="space-y-2">
                    {steps.map((rs: any, i: number) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="p-3 rounded-lg bg-purple-400/5 border border-purple-400/20 text-sm space-y-1 transition-all duration-300 hover:border-purple-400/40 hover:shadow-lg hover:shadow-purple-400/5">
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

            {/* Clarity Improvement — how clarity reduced hallucinations */}
            {result && !loading && clarityData && (() => {
              const confirmed = clarityData.claims.filter(c => c.origin === "confirmed");
              const llmOnly = clarityData.claims.filter(c => c.origin === "llm");
              const sourceOnly = clarityData.claims.filter(c => c.origin === "source");
              return (
                <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider">How Clarity Improved This Answer</h3>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                      clarityData.confidence >= 0.75 ? "text-green-400 border-green-500/30" :
                      clarityData.confidence >= 0.55 ? "text-yellow-400 border-yellow-500/30" :
                      "text-red-400 border-red-500/30"
                    }`}>
                      {Math.round(clarityData.confidence * 100)}% confidence
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Clarity rewrote your query with anti-hallucination techniques, generated an LLM answer, then fused it with evidence from real sources. Claims confirmed by both LLM and sources are trustworthy. LLM-only claims had no source backing and were flagged.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-center transition-all duration-300 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5">
                      <p className="text-lg font-semibold text-emerald-400">{confirmed.length}</p>
                      <p className="text-[10px] text-muted-foreground">Confirmed</p>
                      <p className="text-[9px] text-emerald-400/50">LLM + sources agree</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-center transition-all duration-300 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5">
                      <p className="text-lg font-semibold text-amber-400">{llmOnly.length}</p>
                      <p className="text-[10px] text-muted-foreground">LLM-only</p>
                      <p className="text-[9px] text-amber-400/50">No source backing</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20 text-center transition-all duration-300 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5">
                      <p className="text-lg font-semibold text-blue-400">{sourceOnly.length}</p>
                      <p className="text-[10px] text-muted-foreground">Source-only</p>
                      <p className="text-[9px] text-blue-400/50">Evidence found</p>
                    </div>
                  </div>
                  {/* Techniques used */}
                  <div className="flex flex-wrap gap-1.5">
                    {clarityData.techniques.map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px] px-2 py-0.5 text-muted-foreground">
                        {t.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                  {/* Risks identified */}
                  {clarityData.risks && clarityData.risks.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/20 transition-all duration-300 hover:border-red-500/40 hover:shadow-lg hover:shadow-red-500/5">
                      <p className="text-[10px] font-semibold text-red-400 uppercase mb-1">Hallucination Risks Detected</p>
                      {clarityData.risks.map((r, i) => (
                        <p key={i} className="text-[11px] text-red-400/70">• {r}</p>
                      ))}
                    </div>
                  )}
                  {/* LLM-only claims warning */}
                  {llmOnly.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-amber-400 uppercase">Unconfirmed Claims ({llmOnly.length})</p>
                      {llmOnly.map((c, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/20 text-[11px] transition-all duration-300 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5">
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
                        <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-[11px] transition-all duration-300 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                          <span className="text-muted-foreground">{c.claim}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.section>
              );
            })()}

            {/* Answer Quality — standard verification metrics (non-clarity) */}
            {result && !loading && !clarityData && (() => {
              const claims = result.claims || [];
              const verified = claims.filter((c: any) => c.verified);
              const unverified = claims.filter((c: any) => !c.verified);
              const sources = result.sources || [];
              const contradictions = result.contradictions || [];
              const confidence = result.confidence;
              const domains = new Set(sources.map((s: any) => { try { return new URL(s.url).hostname; } catch { return s.url; } })).size;
              if (claims.length === 0) return null;
              return (
                <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Answer Quality</h3>
                    {confidence != null && (
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                        confidence >= 0.75 ? "text-green-400 border-green-500/30" :
                        confidence >= 0.55 ? "text-yellow-400 border-yellow-500/30" :
                        "text-red-400 border-red-500/30"
                      }`}>
                        {Math.round(confidence * 100)}% confidence
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-center transition-all duration-300 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5">
                      <p className="text-lg font-semibold text-emerald-400">{verified.length}</p>
                      <p className="text-[10px] text-muted-foreground">Verified claims</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-center transition-all duration-300 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5">
                      <p className="text-lg font-semibold text-amber-400">{unverified.length}</p>
                      <p className="text-[10px] text-muted-foreground">Unverified</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20 text-center transition-all duration-300 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5">
                      <p className="text-lg font-semibold text-blue-400">{sources.length}</p>
                      <p className="text-[10px] text-muted-foreground">{domains > 1 ? `Sources (${domains} domains)` : "Sources"}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/20 text-center transition-all duration-300 hover:border-red-500/40 hover:shadow-lg hover:shadow-red-500/5">
                      <p className="text-lg font-semibold text-red-400">{contradictions.length}</p>
                      <p className="text-[10px] text-muted-foreground">Contradictions</p>
                    </div>
                  </div>
                  {contradictions.length > 0 && (
                    <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 transition-all duration-300 hover:border-red-500/40 hover:shadow-lg hover:shadow-red-500/5">
                      <p className="text-[10px] font-semibold text-red-400 uppercase mb-1">Contradictions found</p>
                      {contradictions.map((c: any, i: number) => (
                        <p key={i} className="text-xs text-muted-foreground mb-1">
                          &ldquo;{c.claimA}&rdquo; vs &ldquo;{c.claimB}&rdquo;
                        </p>
                      ))}
                    </div>
                  )}
                  {unverified.length > 0 && (
                    <p className="text-[11px] text-amber-400/70">
                      {unverified.length} claim{unverified.length > 1 ? "s" : ""} could not be verified against sources — treat with caution.
                    </p>
                  )}
                </motion.section>
              );
            })()}

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
                  <Button onClick={() => handleFollowUp(followUpInput)} disabled={!followUpInput.trim()} className="bg-accent text-accent-foreground h-12 px-5 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5">
                    Ask
                  </Button>
                </div>

                <TracePipeline trace={result.trace} />
                <AgentJson result={result} />
                <p className="text-[10px] text-muted-foreground/50 text-center leading-relaxed pt-2">
                  AI-generated research for informational purposes only. Confidence scores are algorithmic estimates, not guarantees.{" "}
                  <a href="/terms" className="underline hover:text-muted-foreground transition-colors">Terms</a>
                </p>
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
