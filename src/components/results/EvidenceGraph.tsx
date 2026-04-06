import { motion } from "framer-motion";
import { Globe, Quote, LinkIcon, CheckCircle2, AlertCircle, Users, AlertTriangle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BrowseClaim, BrowseSource, Contradiction } from "@/lib/api/browse";

const CONSENSUS_COLORS: Record<string, string> = {
  strong: "text-emerald-500 border-emerald-500/30",
  moderate: "text-blue-400 border-blue-400/30",
  weak: "text-muted-foreground border-border",
  none: "text-muted-foreground/50 border-border/50",
};

const CONSENSUS_LABELS: Record<string, string> = {
  strong: "strong consensus",
  moderate: "2-source agreement",
  weak: "single source",
  none: "unverified",
};

export function EvidenceGraph({
  claims,
  sources,
  contradictions,
}: {
  claims: BrowseClaim[];
  sources: BrowseSource[];
  contradictions?: Contradiction[];
}) {
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

      {/* Contradictions warning */}
      {contradictions && contradictions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20"
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <span className="text-xs font-semibold text-amber-500 uppercase tracking-wider">
              {contradictions.length} potential contradiction{contradictions.length !== 1 ? "s" : ""} detected
            </span>
          </div>
          <div className="space-y-2">
            {contradictions.map((c, i) => (
              <div key={i} className="text-xs text-muted-foreground pl-6">
                <p className="italic">"{c.claimA.slice(0, 100)}..."</p>
                <p className="text-amber-500/60 my-0.5">vs</p>
                <p className="italic">"{c.claimB.slice(0, 100)}..."</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

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
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <LinkIcon className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{claim.sources.length} source{claim.sources.length !== 1 ? "s" : ""}</span>
                  {claim.verified !== undefined && (
                    claim.verified ? (
                      <span className="flex items-center gap-0.5 text-xs text-emerald-500">
                        <CheckCircle2 className="w-3 h-3" /> verified
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-xs text-amber-500">
                        <AlertCircle className="w-3 h-3" /> unverified
                      </span>
                    )
                  )}
                  {claim.consensusLevel && claim.consensusLevel !== "none" && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 h-4 ${CONSENSUS_COLORS[claim.consensusLevel] || ""}`}
                    >
                      <Users className="w-3 h-3 mr-0.5" />
                      {CONSENSUS_LABELS[claim.consensusLevel]}
                    </Badge>
                  )}
                  {claim.nliScore && claim.nliScore.label === "entailment" && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 h-4 text-emerald-500 border-emerald-500/30"
                    >
                      <Sparkles className="w-3 h-3 mr-0.5" />
                      {Math.round(claim.nliScore.entailment * 100)}% entails
                    </Badge>
                  )}
                  {claim.nliScore && claim.nliScore.label === "contradiction" && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 h-4 text-red-400 border-red-400/30"
                    >
                      <Sparkles className="w-3 h-3 mr-0.5" />
                      {Math.round(claim.nliScore.contradiction * 100)}% contradicts
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Source connections */}
            <div className="pl-6 border-l-2 border-accent/30 space-y-2 ml-4">
              {claim.sources.map((url) => {
                const src = sourceMap.get(url);
                if (!src) return null;
                return (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block p-3 rounded-lg bg-secondary/50 border border-border/50 hover:border-accent/20 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <Globe className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-xs text-accent font-mono hover:underline">{src.domain}</span>
                      {src.verified && <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />}
                      {src.authority !== undefined && src.authority >= 0.85 && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-3.5 text-blue-400 border-blue-400/30">
                          trusted
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground truncate max-w-[150px] sm:max-w-none">— {src.title}</span>
                    </div>
                    {src.quote && (
                      <div className="flex items-start gap-2 mt-1">
                        <Quote className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                        <p className="text-xs text-muted-foreground italic leading-relaxed">{src.quote}</p>
                      </div>
                    )}
                  </a>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
