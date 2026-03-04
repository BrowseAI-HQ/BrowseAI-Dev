import { motion } from "framer-motion";
import { Code2 } from "lucide-react";
import type { BrowseResult } from "@/lib/api/browse";

export function AgentJson({ result }: { result: BrowseResult }) {
  const json = JSON.stringify(
    { claims: result.claims, sources: result.sources, answer: result.answer, confidence: result.confidence },
    null,
    2
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Code2 className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Agent JSON</h2>
      </div>
      <pre className="p-5 rounded-xl bg-card border border-border overflow-x-auto text-xs font-mono text-secondary-foreground leading-relaxed max-h-[500px] overflow-y-auto">
        {json}
      </pre>
    </motion.section>
  );
}
