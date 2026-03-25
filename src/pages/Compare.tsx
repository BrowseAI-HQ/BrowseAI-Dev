import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, ShieldAlert, Globe, Quote, Bot, Clock, CheckCircle2, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrowseBadge } from "@/components/BrowseBadge";
import { LoginModal } from "@/components/LoginModal";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/contexts/AuthContext";
import { browseCompare, type CompareResult } from "@/lib/api/browse";

const Compare = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get("q") || "";
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [showLoginGate, setShowLoginGate] = useState(false);
  const { user, loading: authLoading } = useAuth();

  // When user logs in after hitting demo limit, dismiss the gate and retry
  useEffect(() => {
    if (user && showLoginGate) {
      setShowLoginGate(false);
      window.location.reload();
    }
  }, [user, showLoginGate]);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    setError(null);
    setShowLoginGate(false);
    browseCompare(query)
      .then(setResult)
      .catch((e) => {
        if (e.message?.includes("DEMO_LIMIT_REACHED")) {
          setShowLoginGate(true);
        } else {
          setError(e.message);
        }
      })
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <div className="min-h-screen relative grid-bg grid-bg-fade">
      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-4 sm:px-8 py-5 border-b border-white/5 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="hover:bg-accent/10 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <img src="/logo.svg" alt="BrowseAI Dev" className="w-4 h-4" />
            <span className="font-semibold text-sm">BrowseAI Dev</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {query && (
            <p className="text-sm text-muted-foreground truncate max-w-[120px] sm:max-w-md font-mono">
              "{query}"
            </p>
          )}
          {!authLoading && (user ? <UserMenu /> : <LoginModal />)}
        </div>
      </nav>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-10">
        {/* Empty state */}
        {!query && !loading && !result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 gap-6 text-center"
          >
            <div className="relative">
              <div className="absolute -inset-4 rounded-full bg-accent/10 blur-xl glow-pulse" />
              <Shield className="w-12 h-12 text-accent relative" />
            </div>
            <p className="text-lg font-medium">Compare Raw LLM vs Evidence-Backed</p>
            <p className="text-sm text-muted-foreground max-w-md">
              Add a query parameter to compare. Example: <code className="text-accent bg-accent/10 px-1.5 py-0.5 rounded">/compare?q=Is caffeine bad for you</code>
            </p>
            <Button onClick={() => navigate("/compare?q=Is caffeine bad for you")} className="glow-pulse">
              Try an example
            </Button>
          </motion.div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="relative">
              <div className="absolute -inset-2 rounded-full bg-accent/20 blur-md glow-pulse" />
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent relative" />
            </div>
            <p className="text-sm text-muted-foreground">Researching with and without verification…</p>
          </div>
        )}

        {/* Login gate */}
        {showLoginGate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 rounded-xl border border-accent/20 bg-card/60 backdrop-blur-sm text-center space-y-4">
            <Shield className="w-10 h-10 text-accent mx-auto animate-float" />
            <h3 className="text-lg font-semibold">Sign in to continue</h3>
            <p className="text-sm text-muted-foreground">Create a free account to get 100 queries/day with premium features.</p>
            <LoginModal open={true} onOpenChange={(open) => { if (!open) { setShowLoginGate(false); navigate("/"); } }} />
          </motion.div>
        )}

        {/* Error */}
        {error && !showLoginGate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-6 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-center backdrop-blur-sm"
          >
            {error}
          </motion.div>
        )}

        {/* Results */}
        {result && result.competitor && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            {/* Stats bar */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-8 py-4 px-6 rounded-xl border border-white/5 bg-card/50 backdrop-blur-sm"
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldAlert className="w-3.5 h-3.5 text-orange-400" />
                <span>{result.competitor.label}: <strong className="text-foreground">{result.competitor.sources} sources</strong></span>
              </div>
              <span className="text-muted-foreground font-mono text-xs">vs</span>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>BrowseAI Dev: <strong className="text-foreground">{result.evidence_backed.sources} sources, {result.evidence_backed.claims} claims</strong></span>
              </div>
            </motion.div>

            {/* Split view */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Competitor side */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-orange-400" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-orange-400">{result.competitor.label}</h2>
                  <Badge className="ml-auto bg-orange-400/15 text-orange-400 border-orange-400/30 text-xs">
                    {result.competitor.sources} sources
                  </Badge>
                </div>
                <div className="p-6 rounded-xl bg-card/60 border border-orange-400/20 min-h-[300px] backdrop-blur-sm hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5 card-lift">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                    {result.competitor.answer}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Sources: {result.competitor.sources}</span>
                  <span>No claim verification</span>
                </div>
              </motion.div>

              {/* Evidence-backed side */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-400">BrowseAI Dev</h2>
                  <Badge className="ml-auto bg-emerald-400/15 text-emerald-400 border-emerald-400/30 text-xs">
                    {Math.round(result.evidence_backed.confidence * 100)}% confidence
                  </Badge>
                </div>
                <div className="p-6 rounded-xl bg-card/60 border border-emerald-400/20 min-h-[300px] backdrop-blur-sm hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5 card-lift">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {result.evidence_backed.answer}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="text-emerald-400">{result.evidence_backed.sources} sources</span>
                  <span className="text-emerald-400">{result.evidence_backed.claims} claims</span>
                  <span className="text-emerald-400">{Math.round(result.evidence_backed.confidence * 100)}% confidence</span>
                </div>

                {result.evidence_backed.citations.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-semibold text-emerald-400/70 uppercase tracking-wider">Sources</h4>
                    {result.evidence_backed.citations.map((src, i) => (
                      <a
                        key={i}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 rounded-lg bg-emerald-400/5 border border-emerald-400/10 hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5 card-lift"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Globe className="w-3 h-3 text-emerald-400/60" />
                          <span className="text-xs text-emerald-400 font-mono">{src.domain}</span>
                          <span className="text-xs text-muted-foreground truncate">- {src.title}</span>
                        </div>
                        {src.quote && (
                          <div className="flex items-start gap-2 mt-1">
                            <Quote className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                            <p className="text-xs text-muted-foreground italic leading-relaxed line-clamp-2">{src.quote}</p>
                          </div>
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </motion.div>
            </div>

            {/* Agent View */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="absolute -inset-1 rounded-full bg-accent/20 blur-sm glow-pulse" />
                    <Bot className="w-5 h-5 text-accent relative" />
                  </div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider">How the Agent Sees It</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1.5 text-muted-foreground hover:text-accent transition-colors"
                  onClick={() => setShowJson(!showJson)}
                >
                  <Code className="w-3.5 h-3.5" />
                  {showJson ? "Hide JSON" : "Show JSON"}
                </Button>
              </div>

              {/* Pipeline Trace */}
              {result.evidence_backed.trace && result.evidence_backed.trace.length > 0 && (
                <div className="p-4 rounded-xl bg-card/60 border border-white/5 backdrop-blur-sm hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5 card-lift">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pipeline Trace</h4>
                  <div className="space-y-2">
                    {result.evidence_backed.trace.map((step, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="font-medium text-foreground w-28 sm:w-36">{step.step}</span>
                        <span className="text-muted-foreground">{step.detail}</span>
                        <span className="ml-auto flex items-center gap-1 text-muted-foreground font-mono">
                          <Clock className="w-3 h-3" />
                          {step.duration_ms}ms
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Claims */}
              {result.evidence_backed.claimDetails && result.evidence_backed.claimDetails.length > 0 && (
                <div className="p-4 rounded-xl bg-card/60 border border-white/5 backdrop-blur-sm hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5 card-lift">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Extracted Claims ({result.evidence_backed.claimDetails.length})
                  </h4>
                  <div className="space-y-3">
                    {result.evidence_backed.claimDetails.map((claim, i) => (
                      <div key={i} className="flex items-start gap-3 text-xs">
                        <Badge variant="outline" className="shrink-0 mt-0.5 text-[10px] px-1.5 border-accent/30 text-accent">
                          {i + 1}
                        </Badge>
                        <div className="space-y-1">
                          <p className="text-foreground leading-relaxed">{claim.claim}</p>
                          <div className="flex flex-wrap gap-1">
                            {claim.sources.map((src, j) => (
                              <span key={j} className="text-[10px] text-accent font-mono bg-accent/10 px-1.5 py-0.5 rounded">
                                {src}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* JSON */}
              {showJson && (
                <div className="p-4 rounded-xl bg-card/60 border border-white/5 backdrop-blur-sm terminal-card hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Raw JSON Response</h4>
                  <pre className="text-xs font-mono text-muted-foreground overflow-x-auto max-h-96 overflow-y-auto leading-relaxed">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              )}
            </motion.div>

            <div className="flex justify-center pt-4">
              <BrowseBadge />
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Compare;
