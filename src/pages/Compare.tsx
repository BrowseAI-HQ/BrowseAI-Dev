import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Zap, Shield, ShieldAlert, Globe, Quote, Bot, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrowseBadge } from "@/components/BrowseBadge";
import { browseCompare, type CompareResult } from "@/lib/api/browse";

const Compare = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get("q") || "";
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    setError(null);
    browseCompare(query)
      .then(setResult)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between px-8 py-5 border-b border-border">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent" />
            <span className="font-semibold text-sm">BrowseAI.dev</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground truncate max-w-md font-mono">
          "{query}"
        </p>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
            <p className="text-sm text-muted-foreground">Running both pipelines in parallel...</p>
          </div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-6 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-center"
          >
            {error}
          </motion.div>
        )}

        {result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            {/* Stats bar */}
            <div className="flex items-center justify-center gap-8 py-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldAlert className="w-4 h-4 text-orange-400" />
                <span>Raw LLM: <strong className="text-foreground">0 sources</strong></span>
              </div>
              <span className="text-muted-foreground">vs</span>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Browse AI: <strong className="text-foreground">{result.evidence_backed.sources} sources, {result.evidence_backed.claims} claims</strong></span>
              </div>
            </div>

            {/* Split view */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Raw LLM side */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-orange-400" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-orange-400">Raw LLM</h2>
                  <Badge className="ml-auto bg-orange-400/15 text-orange-400 border-orange-400/30 text-xs">
                    No sources
                  </Badge>
                </div>
                <div className="p-6 rounded-xl bg-card border border-orange-400/20 min-h-[300px]">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                    {result.raw_llm.answer}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Sources: 0</span>
                  <span>Claims: 0</span>
                  <span>Confidence: Unknown</span>
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
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-400">Browse AI</h2>
                  <Badge className="ml-auto bg-emerald-400/15 text-emerald-400 border-emerald-400/30 text-xs">
                    {Math.round(result.evidence_backed.confidence * 100)}% confidence
                  </Badge>
                </div>
                <div className="p-6 rounded-xl bg-card border border-emerald-400/20 min-h-[300px]">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {result.evidence_backed.answer}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="text-emerald-400">{result.evidence_backed.sources} sources</span>
                  <span className="text-emerald-400">{result.evidence_backed.claims} claims</span>
                  <span className="text-emerald-400">{Math.round(result.evidence_backed.confidence * 100)}% confidence</span>
                </div>

                {/* Sources directly below Browse AI answer */}
                {result.evidence_backed.citations.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-semibold text-emerald-400/70 uppercase tracking-wider">Sources</h4>
                    {result.evidence_backed.citations.map((src, i) => (
                      <a
                        key={i}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 rounded-lg bg-emerald-400/5 border border-emerald-400/10 hover:border-emerald-400/30 transition-colors"
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

            {/* Agent View — How Browse AI sees it */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold uppercase tracking-wider">How the Agent Sees It</h3>
              </div>

              {/* Pipeline trace */}
              {result.evidence_backed.trace && result.evidence_backed.trace.length > 0 && (
                <div className="p-4 rounded-xl bg-card border border-border">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pipeline Trace</h4>
                  <div className="space-y-2">
                    {result.evidence_backed.trace.map((step, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="font-medium text-foreground w-36">{step.step}</span>
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

              {/* Extracted claims */}
              {result.evidence_backed.claimDetails && result.evidence_backed.claimDetails.length > 0 && (
                <div className="p-4 rounded-xl bg-card border border-border">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Extracted Claims ({result.evidence_backed.claimDetails.length})
                  </h4>
                  <div className="space-y-3">
                    {result.evidence_backed.claimDetails.map((claim, i) => (
                      <div key={i} className="flex items-start gap-3 text-xs">
                        <Badge variant="outline" className="shrink-0 mt-0.5 text-[10px] px-1.5">
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
