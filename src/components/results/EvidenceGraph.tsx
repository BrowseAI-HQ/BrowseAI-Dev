import { motion } from "framer-motion";
import { Globe, Quote } from "lucide-react";
import type { BrowseClaim, BrowseSource } from "@/lib/api/browse";

export function EvidenceGraph({ claims, sources }: { claims: BrowseClaim[]; sources: BrowseSource[] }) {
  const sourceMap = new Map(sources.map((s) => [s.url, s]));

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Evidence Graph</h2>
      <div className="space-y-6">
        {claims.map((claim, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.08 }}
            className="relative"
          >
            {/* Claim node */}
            <div className="p-4 rounded-lg bg-card border border-border mb-3">
              <p className="text-sm font-medium">{claim.claim}</p>
            </div>

            {/* Source connections */}
            <div className="pl-6 border-l-2 border-accent/30 space-y-2 ml-4">
              {claim.sources.map((url) => {
                const src = sourceMap.get(url);
                if (!src) return null;
                return (
                  <div key={url} className="p-3 rounded-lg bg-secondary/50 border border-border/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Globe className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-accent font-mono">{src.domain}</span>
                      <span className="text-xs text-muted-foreground truncate">— {src.title}</span>
                    </div>
                    {src.quote && (
                      <div className="flex items-start gap-2 mt-1">
                        <Quote className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                        <p className="text-xs text-muted-foreground italic leading-relaxed">{src.quote}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
