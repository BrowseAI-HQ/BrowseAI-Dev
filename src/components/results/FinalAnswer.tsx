import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export function FinalAnswer({ answer, confidence }: { answer: string; confidence: number }) {
  const pct = Math.round(confidence * 100);
  const circumference = 2 * Math.PI * 18;
  const strokeOffset = circumference - (circumference * pct) / 100;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center gap-3 mb-4">
        <Sparkles className="w-4 h-4 text-accent" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Final Answer</h2>
        <div className="ml-auto flex items-center gap-2">
          {/* Confidence ring */}
          <div className="relative w-10 h-10">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="2" className="text-border" />
              <motion.circle
                cx="20" cy="20" r="18" fill="none" strokeWidth="2.5"
                className="text-accent"
                stroke="currentColor"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: strokeOffset }}
                transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-accent">
              {pct}
            </span>
          </div>
        </div>
      </div>
      <div className="p-6 rounded-xl bg-card border border-border">
        <p className="text-lg leading-relaxed whitespace-pre-wrap">{answer}</p>
      </div>
    </motion.section>
  );
}
