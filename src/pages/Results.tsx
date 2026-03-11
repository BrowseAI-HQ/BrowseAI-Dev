import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Share2, GitCompare, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BrowseResult } from "@/lib/api/browse";
import { streamAnswer, type TraceEvent, type SourcePreview, type StreamEvent } from "@/lib/api/stream";
import { FinalAnswer } from "@/components/results/FinalAnswer";
import { EvidenceGraph } from "@/components/results/EvidenceGraph";
import { TracePipeline } from "@/components/results/TracePipeline";
import { AgentJson } from "@/components/results/AgentJson";
import { StreamingPipeline } from "@/components/results/StreamingPipeline";
import { BrowseBadge } from "@/components/BrowseBadge";
import { LoginModal } from "@/components/LoginModal";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/contexts/AuthContext";

const Results = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get("q") || "";
  const depth = (searchParams.get("depth") as "fast" | "thorough") || "fast";
  const [result, setResult] = useState<BrowseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const { user, loading: authLoading } = useAuth();

  // Streaming state
  const [traceSteps, setTraceSteps] = useState<TraceEvent[]>([]);
  const [previewSources, setPreviewSources] = useState<SourcePreview[]>([]);
  const [streamDone, setStreamDone] = useState(false);

  const handleStreamEvent = useCallback((event: StreamEvent) => {
    switch (event.type) {
      case "trace":
        setTraceSteps((prev) => [...prev, event.data]);
        break;
      case "sources":
        setPreviewSources(event.data);
        break;
      case "result":
        setResult(event.data);
        break;
      case "done":
        setStreamDone(true);
        break;
    }
  }, []);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setTraceSteps([]);
    setPreviewSources([]);
    setStreamDone(false);

    streamAnswer(query, depth, handleStreamEvent)
      .then((res) => {
        setResult(res);
        setStreamDone(true);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [query, depth, handleStreamEvent]);

  const handleShare = () => {
    if (!result?.shareId) return;
    const url = `${window.location.origin}/share/${result.shareId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <nav className="flex items-center justify-between px-4 sm:px-8 py-5 border-b border-border">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <img src="/logo.svg" alt="BrowseAI" className="w-4 h-4" />
            <span className="font-semibold text-sm hidden sm:inline">BrowseAI Dev</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={handleShare}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{copied ? "Copied!" : "Share"}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => navigate(`/compare?q=${encodeURIComponent(query)}`)}
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Compare</span>
              </Button>
            </>
          )}
          <p className="text-sm text-muted-foreground truncate hidden sm:block max-w-md font-mono ml-2">
            "{query}"
          </p>
          {!authLoading && (user ? <UserMenu /> : <LoginModal />)}
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        {/* Streaming pipeline progress */}
        {loading && (
          <StreamingPipeline
            steps={traceSteps}
            sources={previewSources}
            done={streamDone}
          />
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

        {result && !loading && (
          <>
            <FinalAnswer answer={result.answer} confidence={result.confidence} />
            <EvidenceGraph claims={result.claims} sources={result.sources} contradictions={result.contradictions} />
            <TracePipeline trace={result.trace} />
            <AgentJson result={result} />
            <div className="flex justify-center pt-4">
              <BrowseBadge />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Results;
