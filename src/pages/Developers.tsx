import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Zap, ArrowRight, GitBranch, Code2, Users, Lightbulb,
  Terminal, Globe, BookOpen, CheckCircle2, Rocket, Heart,
  ExternalLink, Shield, Brain, Layers, Trophy, GitCommitHorizontal, Github,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useContributors } from "@/hooks/useContributors";

const CONTRIBUTION_AREAS = [
  {
    icon: Globe,
    title: "Frontend",
    desc: "React + Vite + shadcn/ui. Build components, improve UX, add animations.",
    examples: ["Better mobile experience", "Dark/light theme toggle", "Result sharing UI"],
  },
  {
    icon: Layers,
    title: "Backend API",
    desc: "Fastify routes and services. Search, extraction, analysis pipelines.",
    examples: ["New extraction strategies", "Caching improvements", "Rate limiting"],
  },
  {
    icon: Terminal,
    title: "MCP Server",
    desc: "The npm package that powers Claude Desktop, Cursor, and Windsurf.",
    examples: ["New MCP tools", "Better error handling", "Streaming support"],
  },
  {
    icon: Brain,
    title: "Research & Prompts",
    desc: "Improve how we extract knowledge, verify claims, and score confidence.",
    examples: ["Multi-source verification", "Contradiction detection", "Better prompts"],
  },
  {
    icon: Code2,
    title: "Python SDK & Integrations",
    desc: "The browseai Python package, LangChain tools, and CrewAI integration.",
    examples: ["Async improvements", "New framework integrations", "SDK documentation"],
  },
];

const ROADMAP_ITEMS = [
  {
    phase: "Done",
    title: "Evidence-backed research",
    desc: "Real-time web search, claim extraction, structured citations with confidence scores.",
    done: true,
  },
  {
    phase: "Done",
    title: "Python SDK & framework integrations",
    desc: "pip install browseai — works with LangChain and CrewAI out of the box.",
    done: true,
  },
  {
    phase: "Done",
    title: "Intelligent caching & source tracking",
    desc: "Smart TTL for time-sensitive queries, automatic domain tracking for every search.",
    done: true,
  },
  {
    phase: "Next",
    title: "Multi-source verification",
    desc: "Cross-reference claims across sources. Consensus scoring. Contradiction detection.",
    done: false,
  },
  {
    phase: "Vision",
    title: "Reliable research infrastructure for every AI agent",
    desc: "Open source, community-driven. The research layer agents trust.",
    done: false,
  },
];

const GOOD_FIRST_ISSUES = [
  "Add loading skeleton components for search results",
  "Improve error messages when API keys are invalid",
  "Add keyboard shortcuts (Cmd+K to search)",
  "Write unit tests for the extraction service",
  "Add a 'copy citation' button to result cards",
  "Implement result pagination",
];

const Developers = () => {
  const navigate = useNavigate();
  const { contributors, loading: contributorsLoading } = useContributors();

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
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" asChild>
            <a href="https://github.com/EiffelHack/BrowserAI-Dev" target="_blank" rel="noopener">
              <Github className="w-4 h-4 sm:hidden" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </Button>
        </div>
      </motion.nav>

      {/* Hero */}
      <section className="min-h-[50vh] sm:min-h-[70vh] flex flex-col items-center justify-center px-6 pt-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl w-full text-center space-y-6"
        >
          <Badge variant="outline" className="text-xs font-normal">
            Open Source
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
            Build the trust layer
            <br />
            <span className="text-gradient">for AI agents</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            BrowseAI is an open-source research engine that gives AI agents the ability to search the web,
            extract evidence, and produce cited answers. No hallucinations. Just facts.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button className="gap-2" asChild>
              <a href="https://github.com/EiffelHack/BrowserAI-Dev" target="_blank" rel="noopener">
                <GitBranch className="w-4 h-4" />
                View on GitHub
              </a>
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => navigate("/playground")}>
              Try it live
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Contributors Leaderboard — front and center */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-amber-400" />
              <h2 className="text-2xl md:text-3xl font-bold">Top Contributors</h2>
            </div>
            <p className="text-muted-foreground text-center max-w-xl mx-auto mb-10">
              The people making AI more honest. Every merged PR earns your place here.
            </p>

            {contributorsLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent" />
              </div>
            ) : contributors.length > 0 ? (
              <>
                {/* Top 3 podium */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  {contributors.slice(0, 3).map((contributor, i) => {
                    const totalCommits = contributors.reduce((sum, c) => sum + c.contributions, 0);
                    const percentage = Math.round((contributor.contributions / totalCommits) * 100);
                    const medals = ["text-amber-400 border-amber-400/40", "text-gray-400 border-gray-400/40", "text-amber-600 border-amber-600/40"];
                    const medalLabels = ["1st", "2nd", "3rd"];
                    const bgColors = ["bg-amber-400/5", "bg-gray-400/5", "bg-amber-600/5"];
                    return (
                      <motion.a
                        key={contributor.login}
                        href={contributor.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 + i * 0.1 }}
                        className={`flex flex-col items-center gap-3 p-6 rounded-xl border ${bgColors[i]} ${medals[i].split(" ")[1]} hover:border-accent/30 transition-colors group`}
                      >
                        <Badge variant="outline" className={`text-xs ${medals[i]}`}>
                          {medalLabels[i]}
                        </Badge>
                        <img
                          src={contributor.avatar_url}
                          alt={contributor.login}
                          className={`w-16 h-16 rounded-full border-2 ${medals[i].split(" ")[1]} group-hover:border-accent/30 transition-colors`}
                        />
                        <span className="font-semibold text-sm group-hover:text-accent transition-colors">
                          {contributor.login}
                        </span>
                        <div className="w-full space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="font-mono">{contributor.contributions} commits</span>
                            <span>{percentage}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              transition={{ delay: 0.6 + i * 0.1, duration: 0.8 }}
                              className={`h-full rounded-full ${i === 0 ? "bg-amber-400" : i === 1 ? "bg-gray-400" : "bg-amber-600"}`}
                            />
                          </div>
                        </div>
                      </motion.a>
                    );
                  })}
                </div>

                {/* Rest of contributors */}
                {contributors.length > 3 && (
                  <div className="space-y-2">
                    {contributors.slice(3).map((contributor, i) => {
                      const totalCommits = contributors.reduce((sum, c) => sum + c.contributions, 0);
                      const percentage = Math.round((contributor.contributions / totalCommits) * 100);
                      return (
                        <motion.a
                          key={contributor.login}
                          href={contributor.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          initial={{ opacity: 0, x: -10 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: i * 0.03 }}
                          className="flex items-center gap-4 p-3 rounded-xl bg-card border border-border hover:border-accent/30 transition-colors group"
                        >
                          <span className="text-xs font-mono text-muted-foreground w-6 text-right">
                            #{i + 4}
                          </span>
                          <img
                            src={contributor.avatar_url}
                            alt={contributor.login}
                            className="w-8 h-8 rounded-full border border-border group-hover:border-accent/30 transition-colors"
                          />
                          <span className="font-medium text-sm group-hover:text-accent transition-colors flex-shrink-0">
                            {contributor.login}
                          </span>
                          <div className="flex-1 mx-2 hidden sm:block">
                            <div className="w-full h-1 rounded-full bg-secondary overflow-hidden">
                              <div
                                className="h-full rounded-full bg-accent/40"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
                            <GitCommitHorizontal className="w-3 h-3" />
                            <span className="font-mono">{contributor.contributions}</span>
                          </div>
                        </motion.a>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">
                Be the first contributor! Fork the repo and submit a PR.
              </p>
            )}
          </motion.div>
        </div>
      </section>

      {/* The Story */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="flex items-center gap-2 mb-6">
              <Heart className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold uppercase tracking-wider">The Story</h2>
            </div>
            <div className="space-y-6 text-muted-foreground leading-relaxed">
              <p className="text-lg">
                I built BrowseAI because I was tired of AI making things up.
              </p>
              <p>
                As a developer using AI assistants daily, I kept running into the same problem: the AI would confidently
                cite sources that don't exist, reference papers that were never written, and state "facts" that are completely wrong.
                It sounds right. It reads well. But it's fiction.
              </p>
              <p>
                I use AI agents — Claude Code, Cursor, Codex — to build code and ship products every day.
                Before writing code or building anything, I always want to research first: what's the best approach,
                what libraries exist, what patterns work. So I tell my agents to research before they code.
                But they hallucinate. They recommend packages that don't exist, reference APIs that were deprecated years ago,
                and confidently describe solutions that simply don't work.
                The result? Either the product gets built wrong and I discover it later, or I end up doing the
                research myself anyway — defeating the whole point of using AI to move faster.
              </p>
              <p>
                The cost of this isn't just wrong answers — it's eroded trust. When you can't tell if an AI response
                is real or hallucinated, you end up manually verifying everything anyway. That defeats the purpose.
              </p>
              <p>
                BrowseAI takes a different approach: <span className="text-foreground font-medium">every answer goes through a verification pipeline</span>.
                It searches the real web, fetches real pages, extracts real quotes, and links every claim back to its source.
                If it can't find evidence, it says so. Now when I tell my AI agents to research something,
                they can use BrowseAI to actually verify their findings against real sources before writing a single line of code.
              </p>
              <p>
                This is open source because the trust layer for AI shouldn't be owned by one company.
                It should be transparent, auditable, and community-driven.
              </p>
              <p className="text-foreground font-medium">
                If you believe AI should be honest, you're in the right place.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How I Use It */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="flex items-center gap-2 mb-6">
              <Code2 className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold uppercase tracking-wider">How to Use It</h2>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold mb-8">Four ways to get started</h3>

            <div className="space-y-6">
              <div className="p-5 rounded-xl bg-card border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px]">1</Badge>
                  <span className="font-semibold">Web — Try it now</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Go to the playground page, type a question, and see the full evidence pipeline in action.
                  No signup needed. Bring your own API keys for unlimited usage.
                </p>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/playground")}>
                  Open Playground <ArrowRight className="w-3 h-3" />
                </Button>
              </div>

              <div className="p-5 rounded-xl bg-card border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px]">2</Badge>
                  <span className="font-semibold">MCP Server — For AI assistants</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Install as an MCP server for Claude Desktop, Cursor, or Windsurf. Your AI assistant
                  gets 5 research tools it can call to verify information.
                </p>
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary">
                  <Terminal className="w-4 h-4 text-accent" />
                  <code className="text-sm font-mono">npx browse-ai setup</code>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-card border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px]">3</Badge>
                  <span className="font-semibold">Python SDK — For agents & scripts</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Install the Python SDK for LangChain, CrewAI, or any Python agent.
                  Sync and async support built in.
                </p>
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary mb-3">
                  <Terminal className="w-4 h-4 text-accent" />
                  <code className="text-sm font-mono">pip install browseai</code>
                </div>
                <pre className="text-xs font-mono text-muted-foreground bg-secondary rounded-lg p-4 overflow-x-auto">{`from browseai import BrowseAI

client = BrowseAI(api_key="bai_xxx")
result = client.ask("What causes aurora borealis?")
print(result.answer, result.confidence)`}</pre>
              </div>

              <div className="p-5 rounded-xl bg-card border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px]">4</Badge>
                  <span className="font-semibold">REST API — For any language</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Use the REST API from any HTTP client. Self-host or use the hosted version.
                </p>
                <pre className="text-xs font-mono text-muted-foreground bg-secondary rounded-lg p-4 overflow-x-auto">{`curl -X POST https://browseai.dev/api/browse/answer \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: bai_your_key" \\
  -d '{"query": "What causes aurora borealis?"}'`}</pre>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="flex items-center gap-2 mb-6">
              <Rocket className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold uppercase tracking-wider">Roadmap</h2>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold mb-8">Where we're headed</h3>

            <div className="space-y-4">
              {ROADMAP_ITEMS.map((item, i) => (
                <motion.div
                  key={item.phase}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className={`p-5 rounded-xl border ${item.done ? "bg-accent/5 border-accent/20" : "bg-card border-border"}`}
                >
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className={`shrink-0 mt-0.5 text-[10px] px-1.5 ${item.done ? "border-accent/40 text-accent" : ""}`}>
                      {item.phase}
                    </Badge>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{item.title}</span>
                        {item.done && <CheckCircle2 className="w-4 h-4 text-accent" />}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Contribute */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Users className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold uppercase tracking-wider">Contribute</h2>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold mb-4">Help us build this</h3>
            <p className="text-muted-foreground max-w-xl mx-auto">
              BrowseAI is built by developers, for developers. Here's where you can make an impact.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {CONTRIBUTION_AREAS.map((area, i) => (
              <motion.div
                key={area.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-5 rounded-xl bg-card border border-border"
              >
                <div className="flex items-center gap-2 mb-3">
                  <area.icon className="w-4 h-4 text-accent" />
                  <span className="font-semibold">{area.title}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{area.desc}</p>
                <div className="flex flex-wrap gap-2">
                  {area.examples.map((ex) => (
                    <span key={ex} className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground">
                      {ex}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Good First Issues */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-4 h-4 text-accent" />
              <h4 className="font-semibold">Good first issues</h4>
            </div>
            <div className="space-y-2">
              {GOOD_FIRST_ISSUES.map((issue) => (
                <div key={issue} className="flex items-start sm:items-center gap-2 sm:gap-3 p-3 rounded-lg bg-card border border-border">
                  <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5 sm:mt-0 text-emerald-400 border-emerald-400/30">
                    good first issue
                  </Badge>
                  <span className="text-sm text-muted-foreground">{issue}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Getting Started */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="flex items-center gap-2 mb-6">
              <BookOpen className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold uppercase tracking-wider">Getting Started</h2>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold mb-8">How to contribute</h3>

            <div className="space-y-4">
              {[
                { step: "1", cmd: "# Fork on GitHub, then:", label: "Fork the repo", isNote: true },
                { step: "2", cmd: "git clone https://github.com/YOUR_USERNAME/BrowserAI-Dev.git && cd BrowserAI-Dev", label: "Clone your fork" },
                { step: "3", cmd: "pnpm install && cp .env.example .env", label: "Install & configure" },
                { step: "4", cmd: "git checkout -b feat/your-feature", label: "Create a branch" },
                { step: "5", cmd: "pnpm dev", label: "Start development" },
                { step: "6", cmd: "pnpm lint && pnpm test", label: "Run checks" },
                { step: "7", cmd: "# Push your branch and open a PR against main", label: "Submit a Pull Request", isNote: true },
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

            <div className="mt-6 p-4 rounded-xl bg-accent/5 border border-accent/20">
              <p className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">Branch naming:</span>{" "}
                <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">feat/...</code> for features,{" "}
                <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">fix/...</code> for bugs,{" "}
                <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">docs/...</code> for documentation.
                One feature per PR — keep changes focused.
              </p>
            </div>

            <div className="mt-4 p-5 rounded-xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-accent" />
                <span className="font-semibold text-sm">CI/CD runs automatically</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Every PR runs lint, type-check, build, and tests via GitHub Actions.
                Once approved and merged, Vercel deploys the app, Supabase migrations run, and the MCP
                package auto-publishes to npm. You just write code — we handle the rest.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="space-y-6">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">Let's build honest AI together</h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Every contribution — whether it's a bug fix, a new feature, or a better prompt — makes
              AI more trustworthy for everyone.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button className="gap-2" asChild>
                <a href="https://github.com/EiffelHack/BrowserAI-Dev" target="_blank" rel="noopener">
                  <GitBranch className="w-4 h-4" />
                  Start Contributing
                </a>
              </Button>
              <Button variant="outline" className="gap-2" asChild>
                <a href="https://github.com/EiffelHack/BrowserAI-Dev/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener">
                  <BookOpen className="w-4 h-4" />
                  Read the Guide
                  <ExternalLink className="w-3 h-3" />
                </a>
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
            <a href="https://github.com/EiffelHack/BrowserAI-Dev" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
            <button onClick={() => navigate("/")} className="hover:text-foreground transition-colors">Home</button>
            <button onClick={() => navigate("/playground")} className="hover:text-foreground transition-colors">Playground</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Developers;
