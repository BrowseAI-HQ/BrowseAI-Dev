import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Code2, Terminal, ArrowRight, ExternalLink, Github,
  BookOpen, Layers, Brain, Search, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrowseLogo } from "@/components/BrowseLogo";

const GITHUB_EXAMPLES = "https://github.com/BrowseAI-HQ/BrowserAI-Dev/blob/main/examples";

const RECIPES = [
  {
    title: "Research Agent",
    desc: "Ask any question and get evidence-backed answers with citations, confidence scores, and source quotes.",
    file: "research-agent.py",
    cmd: 'python examples/research-agent.py "What are the latest breakthroughs in fusion energy?"',
    tags: ["Python", "Citations", "Confidence"],
    icon: Search,
    github: `${GITHUB_EXAMPLES}/research-agent.py`,
  },
  {
    title: "Code Research Agent",
    desc: "Research libraries, frameworks, and docs before writing code. Perfect for AI coding assistants.",
    file: "code-research-agent.py",
    cmd: 'python examples/code-research-agent.py "best Python async HTTP libraries"',
    tags: ["Python", "Developer Tools", "Multi-step"],
    icon: Code2,
    github: `${GITHUB_EXAMPLES}/code-research-agent.py`,
  },
  {
    title: "Hallucination Detector",
    desc: "Compare what a raw LLM says vs what evidence-backed research says. Spot hallucinations instantly.",
    file: "hallucination-detector.py",
    cmd: 'python examples/hallucination-detector.py "Did India win the 2026 T20 World Cup?"',
    tags: ["Python", "Comparison", "Verification"],
    icon: Shield,
    github: `${GITHUB_EXAMPLES}/hallucination-detector.py`,
  },
  {
    title: "LangChain Agent",
    desc: "Drop BrowseAI Dev tools into any LangChain agent. Search, ask, and extract with evidence.",
    file: "langchain-agent.py",
    cmd: "pip install browseai[langchain] && python examples/langchain-agent.py",
    tags: ["LangChain", "Agent Framework", "Tools"],
    icon: Layers,
    github: `${GITHUB_EXAMPLES}/langchain-agent.py`,
  },
  {
    title: "CrewAI Research Team",
    desc: "Multi-agent team: one agent researches with BrowseAI Dev, another analyzes and writes a report.",
    file: "crewai-research-team.py",
    cmd: "pip install browseai[crewai] && python examples/crewai-research-team.py",
    tags: ["CrewAI", "Multi-Agent", "Reports"],
    icon: Brain,
    github: `${GITHUB_EXAMPLES}/crewai-research-team.py`,
  },
  {
    title: "MCP Server for AI Assistants",
    desc: "Give Claude Desktop, Cursor, or Windsurf 5 research tools. Search, open, extract, answer, and compare — all via MCP.",
    file: "npx browse-ai",
    cmd: "npx browse-ai setup",
    tags: ["MCP", "Claude Desktop", "Cursor", "npm"],
    icon: Terminal,
    github: "https://github.com/BrowseAI-HQ/BrowserAI-Dev/tree/main/apps/mcp",
  },
];

const Recipes = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 flex items-center justify-between px-4 sm:px-8 py-5 z-50 bg-background/80 backdrop-blur-sm border-b border-border/50"
      >
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
          <img src="/logo.svg" alt="BrowseAI" className="w-5 h-5" />
          <span className="font-semibold text-sm tracking-tight">BrowseAI Dev</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={() => navigate("/")}>
            <img src="/logo.svg" alt="Home" className="w-4 h-4 sm:hidden" />
            <span className="hidden sm:inline">Home</span>
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={() => navigate("/playground")}>
            <Terminal className="w-4 h-4 sm:hidden" />
            <span className="hidden sm:inline">Playground</span>
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={() => navigate("/developers")}>
            <Code2 className="w-4 h-4 sm:hidden" />
            <span className="hidden sm:inline">Developers</span>
          </Button>
          <Button variant="ghost" size="sm" className="text-foreground text-xs font-medium" onClick={() => navigate("/recipes")}>
            <BrowseLogo className="w-4 h-4 sm:hidden" />
            <span className="hidden sm:inline">Recipes</span>
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" asChild>
            <a href="https://github.com/BrowseAI-HQ/BrowserAI-Dev" target="_blank" rel="noopener">
              <Github className="w-4 h-4 sm:hidden" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </Button>
        </div>
      </motion.nav>

      {/* Hero */}
      <section className="min-h-[40vh] sm:min-h-[50vh] flex flex-col items-center justify-center px-6 pt-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl w-full text-center space-y-6"
        >
          <Badge variant="outline" className="text-xs font-normal">
            Agent Recipes
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-[1.05]">
            Ready-to-run
            <br />
            <span className="text-gradient">agent examples</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Clone, install, and run. Each recipe shows a different way to use BrowseAI Dev
            as the research layer in your agent pipeline.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-lg mx-auto">
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary flex-1 w-full sm:w-auto">
              <Terminal className="w-4 h-4 text-accent shrink-0" />
              <code className="text-sm font-mono">pip install browseai</code>
            </div>
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary flex-1 w-full sm:w-auto">
              <Terminal className="w-4 h-4 text-accent shrink-0" />
              <code className="text-sm font-mono">npx browse-ai setup</code>
            </div>
          </div>
        </motion.div>
      </section>

      {/* How it works */}
      <section className="py-12 px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-3 sm:gap-4 text-sm text-muted-foreground"
          >
            <span className="px-3 py-1.5 rounded-lg bg-card border border-border font-medium text-foreground">Agent</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
            <span className="px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 font-medium text-accent">BrowseAI Dev</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
            <span className="px-3 py-1.5 rounded-lg bg-card border border-border font-medium text-foreground">Internet</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
            <span className="px-3 py-1.5 rounded-lg bg-card border border-border font-medium text-foreground">Verified Answers</span>
          </motion.div>
        </div>
      </section>

      {/* Recipes */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {RECIPES.map((recipe, i) => (
              <motion.div
                key={recipe.file}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="p-6 rounded-xl bg-card border border-border hover:border-accent/30 transition-colors flex flex-col"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <recipe.icon className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <span className="font-semibold">{recipe.title}</span>
                    <Badge variant="outline" className="text-[10px] font-mono ml-2">{recipe.file}</Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4 flex-1">{recipe.desc}</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {recipe.tags.map((tag) => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="px-4 py-2.5 rounded-lg bg-secondary overflow-x-auto">
                  <code className="text-xs font-mono text-muted-foreground whitespace-nowrap">{recipe.cmd}</code>
                </div>
                <a
                  href={recipe.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 mt-3 text-xs text-accent hover:underline"
                >
                  <Github className="w-3 h-3" />
                  View source on GitHub
                  <ExternalLink className="w-3 h-3" />
                </a>
              </motion.div>
            ))}

            {/* Coming soon card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: RECIPES.length * 0.08 }}
              className="p-6 rounded-xl border border-dashed border-border/60 flex flex-col items-center justify-center text-center gap-3"
            >
              <div className="p-2 rounded-lg bg-secondary">
                <BrowseLogo className="w-4 h-4 text-muted-foreground" />
              </div>
              <span className="font-semibold text-muted-foreground">More coming soon</span>
              <p className="text-sm text-muted-foreground">
                Have an idea for a recipe? Open a PR or share it on Discord.
              </p>
              <Button variant="outline" size="sm" className="gap-1.5 mt-1" asChild>
                <a href="https://github.com/BrowseAI-HQ/BrowserAI-Dev" target="_blank" rel="noopener">
                  Contribute <ArrowRight className="w-3 h-3" />
                </a>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Quick start guide */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="flex items-center gap-2 mb-6">
              <BookOpen className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold uppercase tracking-wider">Quick Start</h2>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold mb-8">Get started</h3>

            <p className="text-sm font-medium text-foreground mb-4">Python SDK</p>
            <div className="space-y-4 mb-8">
              {[
                { step: "1", label: "Clone the repo", cmd: "git clone https://github.com/BrowseAI-HQ/BrowserAI-Dev.git && cd BrowserAI-Dev" },
                { step: "2", label: "Install the SDK", cmd: "pip install browseai" },
                { step: "3", label: "Run a recipe", cmd: 'python examples/research-agent.py "your question here"' },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3">
                  <Badge variant="outline" className="shrink-0 mt-1 text-[10px] px-1.5">{item.step}</Badge>
                  <div className="flex-1">
                    <span className="text-sm font-medium block mb-1">{item.label}</span>
                    <div className="px-4 py-2.5 rounded-lg bg-secondary overflow-x-auto">
                      <code className="text-xs font-mono text-muted-foreground whitespace-nowrap">{item.cmd}</code>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-sm font-medium text-foreground mb-4 mt-8">MCP Server (Claude Desktop, Cursor, Windsurf)</p>
            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="shrink-0 mt-1 text-[10px] px-1.5">1</Badge>
                <div className="flex-1">
                  <span className="text-sm font-medium block mb-1">Run setup</span>
                  <div className="px-4 py-2.5 rounded-lg bg-secondary overflow-x-auto">
                    <code className="text-xs font-mono text-muted-foreground whitespace-nowrap">npx browse-ai setup</code>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="p-4 rounded-xl bg-accent/5 border border-accent/20">
                <p className="text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">Option 1 — BrowseAI API key:</span>{" "}
                  Log in at <a href="https://browseai.dev" className="text-accent hover:underline">browseai.dev</a>, get a <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">bai_xxx</code> key,
                  and use it everywhere. One key, all tools, no setup.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border">
                <p className="text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">Option 2 — Bring Your Own Keys:</span>{" "}
                  Pass your Tavily and OpenRouter keys directly. No BrowseAI account needed.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold">Build your own agent recipe</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              BrowseAI Dev gives your agents reliable web research. Build something cool and share it with the community.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button className="gap-2" asChild>
                <a href="https://github.com/BrowseAI-HQ/BrowserAI-Dev/tree/main/examples" target="_blank" rel="noopener">
                  <Code2 className="w-4 h-4" />
                  View on GitHub
                  <ExternalLink className="w-3 h-3" />
                </a>
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => navigate("/playground")}>
                <Terminal className="w-4 h-4" />
                Try Playground
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <img src="/logo.svg" alt="BrowseAI" className="w-4 h-4" />
            <span className="text-sm font-semibold">BrowseAI Dev</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <a href="https://github.com/BrowseAI-HQ/BrowserAI-Dev" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
            <a href="https://discord.gg/ubAuT4YQsT" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Discord</a>
            <button onClick={() => navigate("/")} className="hover:text-foreground transition-colors">Home</button>
            <button onClick={() => navigate("/developers")} className="hover:text-foreground transition-colors">Developers</button>
            <button onClick={() => navigate("/playground")} className="hover:text-foreground transition-colors">Playground</button>
            <button onClick={() => navigate("/privacy")} className="hover:text-foreground transition-colors">Privacy</button>
            <button onClick={() => navigate("/terms")} className="hover:text-foreground transition-colors">Terms</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Recipes;
