import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <nav className="flex items-center gap-4 px-4 sm:px-8 py-5 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
          <img src="/logo.svg" alt="BrowseAI Dev" className="w-4 h-4" />
          <span className="font-semibold text-sm">BrowseAI Dev</span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: March 8, 2026</p>
        </div>

        <div className="prose prose-invert prose-sm max-w-none space-y-6">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Overview</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              BrowseAI Dev ("we", "us", "our") operates browseai.dev. This policy describes how we collect, use, and protect your information when you use our website, API, MCP server, and Python SDK.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Information We Collect</h2>
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Account Information</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                When you sign in, we collect your email address and basic profile information provided by your authentication provider (Google, GitHub). This is used solely for account management and API key generation.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium">API Keys</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                If you store third-party API keys (Tavily, OpenRouter) with us, they are encrypted using AES-256-GCM before storage. We never log, share, or access your keys in plaintext. Keys stored in browser localStorage never leave your device.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Usage Data</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We collect anonymized usage metrics including: search queries (for result caching and analytics), response times, confidence scores, and source domains. For authenticated users, query history is stored and accessible from your dashboard.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Analytics</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We use Vercel Analytics and PostHog for product analytics. These collect standard web analytics data (page views, device type, browser). PostHog is configured to respect Do Not Track headers.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              <li>To provide and maintain the BrowseAI Dev service</li>
              <li>To generate and manage your BrowseAI API keys</li>
              <li>To cache search results and improve response times</li>
              <li>To display your query history and usage statistics</li>
              <li>To improve the product based on aggregate usage patterns</li>
              <li>To improve verification accuracy through aggregated, anonymized domain-level signals (see below)</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Data Used to Improve Accuracy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              BrowseAI Dev uses aggregated, anonymized verification data from queries processed through the hosted service to improve the accuracy of future results. Specifically:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              <li><strong className="text-foreground">Domain authority scores</strong> — We track how often claims from specific domains are successfully verified. Over time, this data is used to adjust domain trustworthiness scores via Bayesian smoothing. Only domain-level aggregates are stored (e.g., "wikipedia.org has an 82% verification rate across 500 queries") — individual queries are not linked to these scores.</li>
              <li><strong className="text-foreground">Cache improvements</strong> — Cached results from previous queries improve response times for all users. Cached data expires based on time-sensitivity (5 min for news, 30 min for general knowledge).</li>
              <li><strong className="text-foreground">No personal data in aggregates</strong> — Verification aggregates are computed at the domain level, not the query or user level. Your specific search queries are never used to train models or shared with other users.</li>
            </ul>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This data flywheel is a core part of how BrowseAI Dev improves over time. By using the hosted service, you benefit from the collective verification data of all users — making every result more accurate. Self-hosted instances do not participate in this shared data pool and start with static domain scores only.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Data Sharing</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We do not sell your personal data. Your search queries are sent to third-party APIs (Tavily for web search, OpenRouter for LLM processing) as part of the service. These providers have their own privacy policies. We do not share your account information with any third parties.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Data Storage & Security</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Data is stored in Supabase (PostgreSQL) with row-level security. API keys are encrypted at rest using AES-256-GCM. All connections use TLS. We retain query data for as long as your account is active. You can delete your account and all associated data by contacting us.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">BYOK (Bring Your Own Keys)</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              When using BYOK via browser headers (X-Tavily-Key, X-OpenRouter-Key), your keys are transmitted over HTTPS but are never stored on our servers. They are used only for the duration of the request. Keys stored in browser localStorage are never sent to our servers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Your Rights</h2>
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              <li>Access your stored data via the dashboard</li>
              <li>Delete your API keys at any time</li>
              <li>Request full account deletion</li>
              <li>Export your query history</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Open Source</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              BrowseAI Dev is open source. You can audit exactly what data we collect and how we process it by reviewing our{" "}
              <a href="https://github.com/BrowseAI-HQ/BrowseAI-Dev" target="_blank" rel="noopener" className="text-accent hover:underline">
                source code
              </a>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Contact</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              For privacy-related questions, email{" "}
              <a href="mailto:shreyassaw@gmail.com" className="text-accent hover:underline">shreyassaw@gmail.com</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
