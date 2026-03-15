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

/**
 * Returns true if the user cannot search at the current depth.
 * Use this to disable search/ask buttons.
 */
export function isDepthBlocked(
  depth: Depth,
  isLoggedIn: boolean,
  quota?: { premiumActive: boolean } | null,
): boolean {
  if (depth !== "deep") return false;
  if (!isLoggedIn) return true;
  if (quota && !quota.premiumActive) return true;
  return false;
}

export function DepthToggle({ depth, setDepth, quota, size = "md" }: DepthToggleProps) {
  const { user } = useAuth();
  const [hint, setHint] = useState<string | null>(null);

  const isLoggedIn = !!user;
  const deepAvailable = isLoggedIn && (!quota || quota.premiumActive);
  const blocked = depth === "deep" && !deepAvailable;

  const handleClick = () => {
    const next: Depth =
      depth === "fast" ? "thorough" : depth === "thorough" ? "deep" : "fast";

    setDepth(next);

    // Show hint when landing on deep and it's unavailable
    if (next === "deep" && !deepAvailable) {
      if (!isLoggedIn) {
        setHint("Deep mode requires a BAI key — sign in to unlock");
      } else if (quota && !quota.premiumActive) {
        setHint(`Deep mode exhausted today (${quota.used}/${quota.limit}) — resets in ~24h`);
      }
    } else {
      setHint(null);
    }
  };

  // Auto-dismiss hint after 5s
  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(null), 5000);
    return () => clearTimeout(t);
  }, [hint]);

  const isSm = size === "sm";
  const baseClass = isSm
    ? "h-8 px-2 rounded-lg border text-[10px] font-mono transition-colors"
    : "h-12 px-3 rounded-lg border text-xs font-mono transition-colors";

  const colorClass = blocked
    ? "bg-purple-500/10 border-purple-500/40 text-purple-400 opacity-70"
    : depth === "deep"
    ? "bg-purple-500/10 border-purple-500/40 text-purple-400"
    : depth === "thorough"
    ? "bg-accent/10 border-accent/40 text-accent"
    : "bg-secondary border-border text-muted-foreground hover:text-foreground";

  return (
    <div className="relative">
      <button onClick={handleClick} className={`${baseClass} ${colorClass} flex items-center gap-1`}>
        {blocked && <Lock className="w-3 h-3" />}
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
