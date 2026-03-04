import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Zap, Share2, GitCompare, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { browseKnowledge, type BrowseResult } from "@/lib/api/browse";
import { FinalAnswer } from "@/components/results/FinalAnswer";
import { EvidenceGraph } from "@/components/results/EvidenceGraph";
import { TracePipeline } from "@/components/results/TracePipeline";
import { AgentJson } from "@/components/results/AgentJson";
import { LoadingPipeline } from "@/components/results/LoadingPipeline";
import { BrowseBadge } from "@/components/BrowseBadge";

const Results = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get("q") || "";
  const [result, setResult] = useState<BrowseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    setError(null);
    browseKnowledge(query)
      .then(setResult)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [query]);

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
                {copied ? "Copied!" : "Share"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => navigate(`/compare?q=${encodeURIComponent(query)}`)}
              >
                <GitCompare className="w-3.5 h-3.5" />
                Compare
              </Button>
            </>
          )}
          <p className="text-sm text-muted-foreground truncate max-w-md font-mono ml-2">
            "{query}"
          </p>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        {loading && <LoadingPipeline />}

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
          <>
            <FinalAnswer answer={result.answer} confidence={result.confidence} />
            <EvidenceGraph claims={result.claims} sources={result.sources} />
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
