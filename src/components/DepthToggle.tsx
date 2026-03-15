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

function nextDepth(d: Depth): Depth {
  return d === "fast" ? "thorough" : d === "thorough" ? "deep" : "fast";
}

export function DepthToggle({ depth, setDepth, quota, size = "md" }: DepthToggleProps) {
  const { user } = useAuth();
  const [hint, setHint] = useState<string | null>(null);

  const deepExhausted = quota && !quota.premiumActive;
  const isLoggedIn = !!user;

  const handleClick = () => {
    const next = nextDepth(depth);

    // If switching TO deep, check availability
    if (next === "deep") {
      if (!isLoggedIn) {
        setHint("Deep mode available with BAI key — sign in to unlock");
        setDepth(next); // still allow toggle, API will fallback
        return;
      }
      if (deepExhausted) {
        const resetHours = Math.ceil((quota!.limit - quota!.used + quota!.limit) / quota!.limit * 24 % 24) || 24;
        setHint(`Deep mode exhausted for today (${quota!.used}/${quota!.limit}) — resets in ~${resetHours}h`);
        setDepth(next); // still allow toggle, API will fallback to thorough
        return;
      }
    }
    setHint(null);
    setDepth(next);
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

  const showLock = depth === "deep" && (deepExhausted || !isLoggedIn);

  return (
    <div className="relative">
      <button onClick={handleClick} className={`${baseClass} ${colorClass} flex items-center gap-1`}>
        {showLock && <Lock className="w-3 h-3" />}
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
            {hint}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
