import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

const STEPS = ["Searching the web", "Scraping pages", "Extracting claims", "Building evidence graph", "Generating answer"];

export function LoadingPipeline() {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-8">
      <Loader2 className="w-8 h-8 text-accent animate-spin" />
      <div className="space-y-3 w-full max-w-sm">
        {STEPS.map((step, i) => (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ delay: i * 0.5, duration: 2, repeat: Infinity }}
            className="flex items-center gap-3 text-sm text-muted-foreground"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-glow" />
            {step}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
