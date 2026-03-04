import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { browseKnowledge, type BrowseResult } from "@/lib/api/browse";
import { FinalAnswer } from "@/components/results/FinalAnswer";
import { EvidenceGraph } from "@/components/results/EvidenceGraph";
import { TracePipeline } from "@/components/results/TracePipeline";
import { AgentJson } from "@/components/results/AgentJson";
import { LoadingPipeline } from "@/components/results/LoadingPipeline";

const Results = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get("q") || "";
  const [result, setResult] = useState<BrowseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    setError(null);
    browseKnowledge(query)
      .then(setResult)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [query]);

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
            <span className="font-semibold text-sm">browse.ai</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground truncate max-w-md font-mono">
          "{query}"
        </p>
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
          </>
        )}
      </div>
    </div>
  );
};

export default Results;
