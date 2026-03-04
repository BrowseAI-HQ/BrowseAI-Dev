import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

export function FinalAnswer({ answer, confidence }: { answer: string; confidence: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-accent" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Final Answer</h2>
        <Badge className="ml-auto bg-accent/15 text-accent border-accent/30 text-xs">
          {Math.round(confidence * 100)}% confidence
        </Badge>
      </div>
      <div className="p-6 rounded-xl bg-card border border-border">
        <p className="text-lg leading-relaxed whitespace-pre-wrap">{answer}</p>
      </div>
    </motion.section>
  );
}
