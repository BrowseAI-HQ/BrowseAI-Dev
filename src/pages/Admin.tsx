import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Shield, Activity, Users, Mail, BarChart3, Clock,
  Plus, Trash2, CheckCircle2, Sparkles, Download, Star, GitFork, Package,
  RefreshCw, Globe, Loader2,
} from "lucide-react";
import { BrowseLogo } from "@/components/BrowseLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { UserMenu } from "@/components/UserMenu";
import {
  fetchAdminMetrics,
  fetchWaitlist,
  addAdmin,
  removeAdmin,
  recalculateAuthority,
  importDomainData,
  type AdminMetrics,
  type WaitlistEntry,
  type RecalculateResult,
  type ImportDomainResult,
} from "@/lib/api/apiKeys";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const Admin = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [waitlistTotal, setWaitlistTotal] = useState(0);
  const [loadingData, setLoadingData] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcResult, setRecalcResult] = useState<RecalculateResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportDomainResult | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [m, w] = await Promise.all([fetchAdminMetrics(), fetchWaitlist()]);
      setMetrics(m);
      setWaitlist(w.entries);
      setWaitlistTotal(w.total);
    } catch {
      setForbidden(true);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate("/");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) loadAll();
  }, [user, loadAll]);

  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim()) return;
    setAddingAdmin(true);
    try {
      await addAdmin(newAdminEmail.trim());
      setNewAdminEmail("");
      loadAll();
    } catch {
      // silently fail
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleRemoveAdmin = async (email: string) => {
    try {
      await removeAdmin(email);
      loadAll();
    } catch {
      // silently fail
    }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    setRecalcResult(null);
    try {
      const result = await recalculateAuthority();
      setRecalcResult(result);
    } catch {
      // silently fail
    } finally {
      setRecalculating(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const result = await importDomainData(10000);
      setImportResult(result);
    } catch {
      // silently fail
    } finally {
      setImporting(false);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  if (forbidden || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Admin access required</p>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between px-4 sm:px-8 py-5 border-b border-border">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <img src="/logo.svg" alt="BrowseAI" className="w-4 h-4" />
            <span className="font-semibold text-sm">BrowseAI Dev</span>
          </div>
          <Badge variant="outline" className="text-xs text-accent border-accent/30">Admin</Badge>
        </div>
        <UserMenu />
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-accent" />
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          </div>

          {/* Metrics Grid */}
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Users className="w-4 h-4" />
                    Total Users
                  </div>
                  <p className="text-3xl font-bold">{metrics.totalUsers}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Activity className="w-4 h-4" />
                    Total Queries
                  </div>
                  <p className="text-3xl font-bold">{metrics.totalQueries.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <BrowseLogo className="w-4 h-4" />
                    Today
                  </div>
                  <p className="text-3xl font-bold">{metrics.queriesToday}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Sparkles className="w-4 h-4" />
                    Waitlist
                  </div>
                  <p className="text-3xl font-bold">{metrics.waitlistCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Clock className="w-4 h-4" />
                    Avg Response
                  </div>
                  <p className="text-3xl font-bold">
                    {metrics.avgResponseTimeMs ? `${(metrics.avgResponseTimeMs / 1000).toFixed(1)}s` : "—"}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Package Downloads & GitHub */}
          {metrics && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="w-4 h-4 text-accent" />
                  Package Installs &amp; GitHub
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  {/* npm */}
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Download className="w-4 h-4" />
                      npm (browse-ai)
                    </div>
                    {metrics.packageStats.npm ? (
                      <>
                        <p className="text-2xl font-bold">{metrics.packageStats.npm.totalDownloads.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{metrics.packageStats.npm.weeklyDownloads.toLocaleString()}/week</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">unavailable</p>
                    )}
                  </div>
                  {/* PyPI */}
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Download className="w-4 h-4" />
                      PyPI (browseai)
                    </div>
                    {metrics.packageStats.pypi ? (
                      <>
                        <p className="text-2xl font-bold">{metrics.packageStats.pypi.totalDownloads.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{metrics.packageStats.pypi.weeklyDownloads.toLocaleString()}/week</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">unavailable</p>
                    )}
                  </div>
                  {/* GitHub */}
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Star className="w-4 h-4" />
                      GitHub
                    </div>
                    {metrics.packageStats.github ? (
                      <>
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-2xl font-bold">{metrics.packageStats.github.stars}</p>
                            <p className="text-xs text-muted-foreground">stars</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{metrics.packageStats.github.forks}</p>
                            <p className="text-xs text-muted-foreground">forks</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{metrics.packageStats.github.openIssues}</p>
                            <p className="text-xs text-muted-foreground">issues</p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">unavailable</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Performance */}
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground mb-1">Avg Confidence</div>
                  <p className="text-2xl font-bold">
                    {metrics.avgConfidence ? `${(metrics.avgConfidence * 100).toFixed(0)}%` : "—"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground mb-1">Cache Hit Rate</div>
                  <p className="text-2xl font-bold">
                    {metrics.cacheHitRate != null ? `${(metrics.cacheHitRate * 100).toFixed(0)}%` : "—"}
                  </p>
                </CardContent>
              </Card>
              <Card className="col-span-2 md:col-span-1">
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground mb-1">Admins</div>
                  <p className="text-2xl font-bold">{metrics.admins.length}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Client Breakdown */}
          {metrics && metrics.clientBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-accent" />
                  Client Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {metrics.clientBreakdown.map(({ client, count }) => {
                    const total = metrics.clientBreakdown.reduce((s, c) => s + c.count, 0);
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <div key={client} className="flex items-center gap-3">
                        <span className="text-sm w-24 truncate">{client}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-16 text-right">
                          {count} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Registered Users */}
          {metrics && metrics.users.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-4 h-4 text-accent" />
                  Registered Users
                  <Badge variant="outline" className="text-xs ml-auto">{metrics.totalUsers} users</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {metrics.users.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="w-6 h-6 rounded-full shrink-0" />
                      ) : (
                        <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm truncate block">{u.name || u.email}</span>
                        {u.name && (
                          <span className="text-[10px] text-muted-foreground truncate block">{u.email}</span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 w-20 text-right">
                        {u.last_sign_in_at ? timeAgo(u.last_sign_in_at) : "never"}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0 w-16 text-right">
                        joined {timeAgo(u.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Waitlist */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="w-4 h-4 text-accent" />
                Pro Waitlist
                <Badge variant="outline" className="text-xs ml-auto">{waitlistTotal} signups</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {waitlist.length === 0 ? (
                <p className="text-sm text-muted-foreground">No signups yet.</p>
              ) : (
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {waitlist.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate flex-1">{entry.email}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{entry.source}</Badge>
                      <span className="text-[10px] text-muted-foreground shrink-0 w-16 text-right">
                        {timeAgo(entry.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Domain Authority */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="w-4 h-4 text-accent" />
                Domain Authority
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Button
                  size="sm"
                  onClick={handleRecalculate}
                  disabled={recalculating}
                >
                  {recalculating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Recalculate Authority
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleImport}
                  disabled={importing}
                >
                  {importing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Import Majestic Million
                </Button>
              </div>

              {recalcResult && (
                <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                  <p className="text-sm font-medium text-accent">
                    <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                    Updated {recalcResult.domainsUpdated} domains
                    {recalcResult.persistedToDB && " (persisted to DB)"}
                  </p>
                  {recalcResult.topDomains.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Top domains by verification rate:</p>
                      {recalcResult.topDomains.map((d) => (
                        <div key={d.domain} className="flex items-center gap-2 text-xs">
                          <span className="w-40 truncate">{d.domain}</span>
                          <span className="text-accent font-medium">{(d.score * 100).toFixed(0)}%</span>
                          <span className="text-muted-foreground">({d.samples} samples)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {importResult && (
                <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                  <p className="text-sm font-medium text-accent">
                    <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                    Parsed {importResult.parsed.toLocaleString()} domains, saved {importResult.savedToDB.toLocaleString()} to DB
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Admin Management */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-4 h-4 text-accent" />
                Admin Users
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {metrics?.admins.map((admin) => (
                <div key={admin.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                  <Shield className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span className="text-sm flex-1">{admin.email}</span>
                  <span className="text-[10px] text-muted-foreground">
                    since {new Date(admin.created_at).toLocaleDateString()}
                  </span>
                  {admin.email !== user.email && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveAdmin(admin.email)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}

              <div className="flex gap-2 pt-2 border-t border-border">
                <Input
                  placeholder="Add admin by email..."
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddAdmin()}
                  className="text-sm"
                />
                <Button
                  size="sm"
                  onClick={handleAddAdmin}
                  disabled={addingAdmin || !newAdminEmail.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Admin;
