import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface ClarityToggleProps {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  quota?: { premiumActive: boolean; resetsInSeconds?: number } | null;
  size?: "sm" | "md" | "pill";
}

/**
 * Returns true if the user cannot use Clarity mode.
 * Clarity requires BAI key (premium).
 */
export function isClarityBlocked(
  isLoggedIn: boolean,
  quota?: { premiumActive: boolean } | null,
): boolean {
  if (!isLoggedIn) return true;
  if (quota && !quota.premiumActive) return true;
  return false;
}

export function ClarityToggle({ enabled, setEnabled, quota, size = "md" }: ClarityToggleProps) {
  const { user } = useAuth();
  const [hint, setHint] = useState<string | null>(null);

  const isLoggedIn = !!user;
  const blocked = isClarityBlocked(isLoggedIn, quota);

  const handleClick = () => {
    const next = !enabled;
    setEnabled(next);

    if (next && blocked) {
      if (!isLoggedIn) {
        setHint("Clarity rewrites prompts to reduce hallucinations — requires BAI key, sign in to unlock");
      } else if (quota && !quota.premiumActive) {
        setHint("Premium quota exhausted — Clarity unavailable until reset");
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

  const baseClass =
    size === "sm"
      ? "h-8 px-2 rounded-lg border text-[10px] font-mono transition-colors"
      : size === "pill"
      ? "px-4 py-2 rounded-full border text-xs font-medium transition-all"
      : "h-12 px-3 rounded-lg border text-xs font-mono transition-colors";

  const colorClass = enabled && !blocked
    ? "bg-amber-500/10 border-amber-500/40 text-amber-400"
    : enabled && blocked
    ? "bg-amber-500/10 border-amber-500/40 text-amber-400 opacity-70"
    : "bg-secondary border-border text-muted-foreground hover:text-foreground";

  if (size === "pill") {
    return (
      <>
        <button onClick={handleClick} className={`${baseClass} ${colorClass} flex items-center gap-1`}>
          {enabled && blocked && <Lock className="w-3 h-3" />}
          <Shield className="w-3 h-3" />
          {enabled ? "Clarity ON" : "Clarity"}
        </button>
        <AnimatePresence>
          {hint && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="w-full flex justify-center mt-1"
            >
              <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400">
                <Lock className="w-2.5 h-2.5 inline mr-1" />
                {hint}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className={`${baseClass} ${colorClass} flex items-center gap-1`}
        title="Clarity — anti-hallucination prompt engineering"
      >
        {enabled && blocked && <Lock className="w-3 h-3" />}
        <Shield className="w-3 h-3" />
        {size === "sm" ? "" : "Clarity"}
      </button>
      <AnimatePresence>
        {hint && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full mt-1.5 right-0 z-50 whitespace-nowrap px-3 py-1.5 rounded-lg bg-card border border-border shadow-lg text-[11px] text-muted-foreground"
          >
            <Lock className="w-2.5 h-2.5 inline mr-1" />
            {hint}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
