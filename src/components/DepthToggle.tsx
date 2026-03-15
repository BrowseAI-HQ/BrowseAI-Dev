import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Depth = "fast" | "thorough" | "deep";

interface DepthToggleProps {
  depth: Depth;
  setDepth: (d: Depth) => void;
  quota?: { used: number; limit: number; premiumActive: boolean } | null;
  /** Override size for compact contexts */
  size?: "sm" | "md";
}

export function DepthToggle({ depth, setDepth, quota, size = "md" }: DepthToggleProps) {
  const { user } = useAuth();
  const [hint, setHint] = useState<string | null>(null);

  const isLoggedIn = !!user;
  const deepAvailable = isLoggedIn && (!quota || quota.premiumActive);

  const handleClick = () => {
    if (depth === "fast") {
      setHint(null);
      setDepth("thorough");
    } else if (depth === "thorough") {
      if (deepAvailable) {
        setHint(null);
        setDepth("deep");
      } else {
        // Can't use deep — show hint and cycle back to fast
        if (!isLoggedIn) {
          setHint("Deep mode requires a BAI key — sign in to unlock");
        } else if (quota && !quota.premiumActive) {
          setHint(`Deep mode exhausted today (${quota.used}/${quota.limit}) — resets in ~24h`);
        }
        setDepth("fast");
      }
    } else {
      // deep → fast
      setHint(null);
      setDepth("fast");
    }
  };

  // Auto-dismiss hint after 4s
  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(null), 4000);
    return () => clearTimeout(t);
  }, [hint]);

  const isSm = size === "sm";
  const baseClass = isSm
    ? "h-8 px-2 rounded-lg border text-[10px] font-mono transition-colors"
    : "h-12 px-3 rounded-lg border text-xs font-mono transition-colors";

  const colorClass =
    depth === "deep"
      ? "bg-purple-500/10 border-purple-500/40 text-purple-400"
      : depth === "thorough"
      ? "bg-accent/10 border-accent/40 text-accent"
      : "bg-secondary border-border text-muted-foreground hover:text-foreground";

  return (
    <div className="relative">
      <button onClick={handleClick} className={`${baseClass} ${colorClass} flex items-center gap-1`}>
        {depth === "deep" ? "Deep" : depth === "thorough" ? "Thorough" : "Fast"}
      </button>
      <AnimatePresence>
        {hint && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full mt-1.5 right-0 z-50 whitespace-nowrap px-3 py-1.5 rounded-lg bg-card border border-border shadow-lg text-[11px] text-muted-foreground"
          >
            <Lock className="w-3 h-3 inline mr-1" />
            {hint}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
