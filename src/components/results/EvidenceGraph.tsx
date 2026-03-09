import { motion } from "framer-motion";
import { Globe, Quote, LinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BrowseClaim, BrowseSource } from "@/lib/api/browse";

export function EvidenceGraph({ claims, sources }: { claims: BrowseClaim[]; sources: BrowseSource[] }) {
  const sourceMap = new Map(sources.map((s) => [s.url, s]));

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Evidence Graph</h2>
        <Badge variant="outline" className="text-xs ml-auto">
          {claims.length} claims / {sources.length} sources
        </Badge>
      </div>
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
            <div className="p-4 rounded-lg bg-card border border-border mb-3 flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-accent">{i + 1}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{claim.claim}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  <LinkIcon className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{claim.sources.length} source{claim.sources.length !== 1 ? "s" : ""}</span>
                </div>
              </div>
            </div>

            {/* Source connections */}
            <div className="pl-6 border-l-2 border-accent/30 space-y-2 ml-4">
              {claim.sources.map((url) => {
                const src = sourceMap.get(url);
                if (!src) return null;
                return (
                  <div key={url} className="p-3 rounded-lg bg-secondary/50 border border-border/50 hover:border-accent/20 transition-colors">
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
