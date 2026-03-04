import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const EXAMPLE_PROMPTS = [
  "What is a wormhole?",
  "Why is the sky blue?",
  "What causes inflation?",
];

const Index = () => {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (q?: string) => {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    navigate(`/results?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      {/* Nav */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 flex items-center justify-between px-8 py-5 z-50"
      >
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-accent" />
          <span className="font-semibold text-sm tracking-tight">browse.ai</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground text-xs"
          onClick={() => navigate("/playground")}
        >
          Playground
        </Button>
      </motion.nav>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="max-w-3xl w-full text-center space-y-8"
      >
        <div className="space-y-4">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05]">
            Browsing Infrastructure
            <br />
            <span className="text-gradient">for AI Agents</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto">
            Agents shouldn't read web pages. They should understand the internet.
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-2xl mx-auto">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-accent transition-colors" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Ask something agents need reliable knowledge about…"
              className="w-full h-14 pl-12 pr-36 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all text-base"
            />
            <Button
              onClick={() => handleSearch()}
              disabled={!query.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg px-4 h-10 text-sm font-semibold gap-2"
            >
              Browse Knowledge
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Example chips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap justify-center gap-2"
        >
          {EXAMPLE_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => {
                setQuery(prompt);
                handleSearch(prompt);
              }}
              className="px-4 py-2 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground hover:border-accent/40 transition-all"
            >
              {prompt}
            </button>
          ))}
        </motion.div>
      </motion.div>

      {/* Pipeline hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="fixed bottom-8 text-xs text-muted-foreground/60 flex items-center gap-4 font-mono"
      >
        <span>search</span>
        <span>→</span>
        <span>scrape</span>
        <span>→</span>
        <span>extract</span>
        <span>→</span>
        <span>graph</span>
        <span>→</span>
        <span>answer</span>
      </motion.div>
    </div>
  );
};

export default Index;
