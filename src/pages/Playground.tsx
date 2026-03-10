import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { browseKnowledge, browseSearch, browseExtract } from "@/lib/api/browse";
import { LoginModal } from "@/components/LoginModal";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/contexts/AuthContext";

const Playground = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("search");

  const run = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setResponse(null);
    try {
      let result;
      if (activeTab === "search") {
        result = await browseSearch(input, 5);
      } else if (activeTab === "extract") {
        result = await browseExtract(input);
      } else {
        result = await browseKnowledge(input);
      }
      setResponse(result);
    } catch (e: any) {
      setResponse({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  const placeholders: Record<string, string> = {
    search: "Enter a search query…",
    extract: "Enter a URL to scrape…",
    answer: "Ask a question…",
  };

  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between px-4 sm:px-8 py-5 border-b border-border">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="BrowseAI" className="w-4 h-4" />
            <span className="font-semibold text-sm">Playground</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!authLoading && (user ? <UserMenu /> : <LoginModal />)}
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setResponse(null); }}>
          <TabsList className="bg-secondary">
            <TabsTrigger value="search" className="font-mono text-xs">browse.search</TabsTrigger>
            <TabsTrigger value="extract" className="font-mono text-xs">browse.extract</TabsTrigger>
            <TabsTrigger value="answer" className="font-mono text-xs">browse.answer</TabsTrigger>
          </TabsList>

          {["search", "extract", "answer"].map((tab) => (
            <TabsContent key={tab} value={tab}>
              <div className="flex gap-2 mt-4">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && run()}
                  placeholder={placeholders[tab]}
                  className="flex-1 h-12 px-4 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm font-mono"
                />
                <Button onClick={run} disabled={loading || !input.trim()} className="bg-accent text-accent-foreground h-12 px-5">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {response && (
          <motion.pre
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-xl bg-card border border-border overflow-x-auto text-xs font-mono text-secondary-foreground leading-relaxed max-h-[600px] overflow-y-auto"
          >
            {JSON.stringify(response, null, 2)}
          </motion.pre>
        )}
      </div>
    </div>
  );
};

export default Playground;
