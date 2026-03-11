import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, Brain, Search, FileText, Shield, Sparkles } from "lucide-react";

const PIPELINE_STEPS = [
  { name: "Recall Knowledge", icon: Brain, delay: 0, duration: 800 },
  { name: "Search Web", icon: Search, delay: 1000, duration: 3000 },
  { name: "Fetch Pages", icon: FileText, delay: 4000, duration: 4000 },
  { name: "Extract & Verify", icon: Shield, delay: 8000, duration: 5000 },
  { name: "Generate Answer", icon: Sparkles, delay: 13000, duration: 4000 },
];

/**
 * Simulated pipeline progress for session ask (non-streaming).
 * Shows steps lighting up on a timer to give visual feedback.
 */
export function SessionPipelineProgress() {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const timers = PIPELINE_STEPS.map((step, i) =>
      setTimeout(() => setActiveIdx(i), step.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex flex-col items-center py-8 space-y-6">
      <div className="relative">
        <Loader2 className="w-7 h-7 text-accent animate-spin" />
      </div>

      <div className="w-full max-w-sm space-y-1">
        <AnimatePresence mode="popLayout">
          {PIPELINE_STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === activeIdx;
            const isCompleted = i < activeIdx;
            const isVisible = i <= activeIdx;

            if (!isVisible) return null;

            return (
              <motion.div
                key={step.name}
                initial={{ opacity: 0, x: -15, height: 0 }}
                animate={{ opacity: 1, x: 0, height: "auto" }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-3 py-1.5 px-3 rounded-lg">
                  <div className={`shrink-0 ${
                    isCompleted ? "text-emerald-400" :
                    isActive ? "text-accent" :
                    "text-muted-foreground/40"
                  }`}>
                    {isActive ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isCompleted ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <span className={`text-sm ${
                    isCompleted ? "text-foreground" :
                    isActive ? "text-accent font-medium" :
                    "text-muted-foreground"
                  }`}>
                    {step.name}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
