import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Zap, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FinalAnswer } from "@/components/results/FinalAnswer";
import { EvidenceGraph } from "@/components/results/EvidenceGraph";
import { TracePipeline } from "@/components/results/TracePipeline";
import { BrowseBadge } from "@/components/BrowseBadge";
import type { BrowseResult } from "@/lib/api/browse";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

const Share = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<{ query: string; result: BrowseResult } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`${API_BASE}/browse/share/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setData(d.result);
          document.title = `Browse AI: ${d.result.query}`;
        } else {
          setError(d.error || "Result not found");
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

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
        {data && (
          <p className="text-sm text-muted-foreground truncate max-w-md font-mono">
            "{data.query}"
          </p>
        )}
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
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

        {data && (
          <>
            <FinalAnswer answer={data.result.answer} confidence={data.result.confidence} />
            <EvidenceGraph claims={data.result.claims} sources={data.result.sources} />
            {data.result.trace && <TracePipeline trace={data.result.trace} />}

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col items-center gap-4 py-8"
            >
              <Button
                onClick={() => navigate("/")}
                className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2"
              >
                Try your own query
                <ExternalLink className="w-4 h-4" />
              </Button>
              <BrowseBadge />
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
};

export default Share;
