import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, ExternalLink, Key, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

const TAVILY_KEY = "browse_tavily_key";
const OPENROUTER_KEY = "browse_openrouter_key";

export function hasUserKeys(): boolean {
  return !!(localStorage.getItem(TAVILY_KEY) && localStorage.getItem(OPENROUTER_KEY));
}

export function getUserKeys(): { tavily?: string; openrouter?: string } {
  return {
    tavily: localStorage.getItem(TAVILY_KEY) || undefined,
    openrouter: localStorage.getItem(OPENROUTER_KEY) || undefined,
  };
}

export function ApiKeySettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tavily, setTavily] = useState("");
  const [openrouter, setOpenrouter] = useState("");
  const [saved, setSaved] = useState(false);
  const [keysConfigured, setKeysConfigured] = useState(false);

  useEffect(() => {
    setTavily(localStorage.getItem(TAVILY_KEY) || "");
    setOpenrouter(localStorage.getItem(OPENROUTER_KEY) || "");
    setKeysConfigured(hasUserKeys());
  }, [open]);

  const handleSave = () => {
    if (tavily.trim()) localStorage.setItem(TAVILY_KEY, tavily.trim());
    if (openrouter.trim()) localStorage.setItem(OPENROUTER_KEY, openrouter.trim());
    setKeysConfigured(hasUserKeys());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    (window as any).posthog?.capture("keys_configured");
  };

  const handleClear = () => {
    localStorage.removeItem(TAVILY_KEY);
    localStorage.removeItem(OPENROUTER_KEY);
    setTavily("");
    setOpenrouter("");
    setKeysConfigured(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="relative text-muted-foreground text-xs">
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline ml-1">API Keys</span>
          {keysConfigured && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-4 h-4" />
            API Keys
          </DialogTitle>
          <DialogDescription>
            Enter your own API keys for unlimited access. Keys are stored locally in your browser and never sent to our servers.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4 py-2" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center justify-between">
              Tavily API Key
              <a
                href="https://app.tavily.com"
                target="_blank"
                rel="noopener"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                Get free key <ExternalLink className="w-3 h-3" />
              </a>
            </label>
            <Input
              type="password"
              autoComplete="off"
              placeholder="tvly-..."
              value={tavily}
              onChange={(e) => setTavily(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center justify-between">
              OpenRouter API Key
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                Get free key <ExternalLink className="w-3 h-3" />
              </a>
            </label>
            <Input
              type="password"
              autoComplete="off"
              placeholder="sk-or-..."
              value={openrouter}
              onChange={(e) => setOpenrouter(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              OpenRouter gives you access to 100+ models (GPT-4o, Claude, Gemini, Llama, etc.)
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1" disabled={!tavily.trim() && !openrouter.trim()}>
              {saved ? "Saved!" : "Save Keys"}
            </Button>
            {keysConfigured && (
              <Button variant="outline" size="icon" onClick={handleClear}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Without your own keys, you get 5 demo queries per hour. With your own keys, usage is unlimited.
          </p>

          {user && (
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground">
                Want to use your keys across devices, CLI, and MCP?{" "}
                <button
                  onClick={() => { setOpen(false); navigate("/dashboard"); }}
                  className="text-accent underline hover:no-underline"
                >
                  Save to your account
                </button>{" "}
                and get a single BrowseAI Dev API key.
              </p>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
