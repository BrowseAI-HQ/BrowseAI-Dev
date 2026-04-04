import { useState, useEffect, useCallback } from "react";
import { Key, Plus, Trash2, Copy, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  type ApiKeyRecord,
} from "@/lib/api/apiKeys";

export function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [label, setLabel] = useState("");
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [tavilyKey, setTavilyKey] = useState("");
  const [creating, setCreating] = useState(false);

  // Newly created key dialog
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Delete confirmation dialog
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      const result = await listApiKeys();
      setKeys(result);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const result = await createApiKey(
        label.trim() || undefined,
        openrouterKey.trim() || undefined,
        tavilyKey.trim() || undefined,
      );
      setNewKey(result.apiKey);
      setLabel("");
      setOpenrouterKey("");
      setTavilyKey("");
      fetchKeys();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    // Show confirmation dialog if this is the last key
    if (activeKeys.length <= 1) {
      setDeleteKeyId(id);
      return;
    }
    await doRevoke(id);
  };

  const doRevoke = async (id: string) => {
    setDeleteKeyId(null);
    try {
      await revokeApiKey(id);
      fetchKeys();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const copyKey = () => {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyMcpSnippet = () => {
    if (!newKey) return;
    const snippet = JSON.stringify(
      {
        "browseai-dev": {
          command: "npx",
          args: ["-y", "browseai-dev"],
          env: { BROWSE_API_KEY: newKey },
        },
      },
      null,
      2
    );
    navigator.clipboard.writeText(snippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const activeKeys = keys.filter((k) => !k.revoked);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="w-5 h-5 text-accent" />
            API Keys
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Generate form */}
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); handleCreate(); }}>
            <p className="text-sm text-muted-foreground">
              Generate a BrowseAI Dev API key to use with MCP, Python SDK, REST API, and CLI.
              Add your OpenRouter and Tavily keys to get unlimited access with the full Grounded Intelligence verification pipeline.
            </p>
            <div className="space-y-2">
              <Input
                placeholder="OpenRouter API key (required)"
                value={openrouterKey}
                onChange={(e) => setOpenrouterKey(e.target.value)}
                className="text-xs max-w-md font-mono"
                type="password"
              />
              <Input
                placeholder="Tavily API key (required)"
                value={tavilyKey}
                onChange={(e) => setTavilyKey(e.target.value)}
                className="text-xs max-w-md font-mono"
                type="password"
              />
              <div className="flex items-center gap-3">
                <Input
                  placeholder="Key label (optional, e.g. 'cursor', 'production')"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="text-xs max-w-xs"
                />
                <Button
                  onClick={handleCreate}
                  disabled={creating || !openrouterKey.trim() || !tavilyKey.trim()}
                  className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
                  size="sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {creating ? "Generating..." : "Generate API Key"}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Get your keys: <a href="https://openrouter.ai/keys" target="_blank" rel="noopener" className="text-accent hover:underline">OpenRouter</a> · <a href="https://app.tavily.com/home" target="_blank" rel="noopener" className="text-accent hover:underline">Tavily</a>
            </p>
          </form>

          {/* Existing keys */}
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent" />
            </div>
          ) : activeKeys.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Your Keys
              </h4>
              {activeKeys.map((key, index) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border"
                >
                  <div className="flex items-center gap-3">
                    <code className="text-xs font-mono text-accent">
                      {key.api_key_prefix}...
                    </code>
                    <span className="text-xs text-muted-foreground">
                      {key.label}
                    </span>
                    {index === 0 && (
                      <Badge className="text-[10px] bg-accent/10 text-accent border-accent/20">
                        Default
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px]">
                      {new Date(key.created_at).toLocaleDateString()}
                    </Badge>
                    {key.last_used_at && (
                      <span className="text-[10px] text-muted-foreground">
                        Last used{" "}
                        {new Date(key.last_used_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive h-7 w-7 p-0"
                    onClick={() => handleRevoke(key.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">
              No API keys yet. Generate one above.
            </p>
          )}
        </CardContent>
      </Card>

      {/* New key dialog */}
      <Dialog open={!!newKey} onOpenChange={() => setNewKey(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-4 h-4 text-accent" />
              Your BrowseAI Dev API Key
            </DialogTitle>
            <DialogDescription>
              Copy this key now. It will not be shown again.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border">
              <code className="text-sm font-mono flex-1 break-all">
                {newKey}
              </code>
              <Button variant="ghost" size="sm" onClick={copyKey} className="shrink-0">
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-400/10 border border-orange-400/20">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0" />
              <p className="text-xs text-orange-400">
                This key will only be shown once. Store it securely.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground">
                MCP Config (Claude Desktop / Cursor)
              </h4>
              <pre className="text-xs font-mono bg-muted p-3 rounded-lg overflow-x-auto">
{`{
  "browseai-dev": {
    "command": "npx",
    "args": ["-y", "browseai-dev"],
    "env": {
      "BROWSE_API_KEY": "${newKey}"
    }
  }
}`}
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={copyMcpSnippet}
              >
                {copiedSnippet ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copiedSnippet ? "Copied!" : "Copy MCP Config"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete last key confirmation */}
      <Dialog open={!!deleteKeyId} onOpenChange={() => setDeleteKeyId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              Remove last API key?
            </DialogTitle>
            <DialogDescription>
              This is your only API key. Removing it will limit you to the
              website demo (<strong>1 query/hour</strong>). Generate a new
              key anytime to restore full access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setDeleteKeyId(null)}>
              Keep key
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteKeyId && doRevoke(deleteKeyId)}
            >
              Remove key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
