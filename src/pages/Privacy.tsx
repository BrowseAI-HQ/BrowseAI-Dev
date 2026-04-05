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
          <p className="text-sm text-muted-foreground">Last updated: April 5, 2026</p>
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
                Your BrowseAI Dev API keys (bai_xxx) are encrypted using AES-256-GCM before storage. We never log, share, or access your keys in plaintext.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Queries & Results</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Your queries and results are stored on our servers.</strong> When you submit a query through the hosted service (browseai.dev, REST API, MCP server, or Python SDK with a BAI key), we store the query text, the full result (answer, claims, sources, confidence scores), and metadata (timestamps, depth mode, client type). For authenticated users, results are linked to your account and visible in your query history.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Usage Data</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We collect usage metrics including: response times, confidence scores, source domains, verification rates, and feedback ratings. For authenticated users, query history is stored and accessible from your dashboard.
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
              <li>To generate and manage your BrowseAI Dev API keys</li>
              <li>To cache search results and improve response times</li>
              <li>To display your query history and usage statistics</li>
              <li>To improve the product based on aggregate usage patterns</li>
              <li>To improve verification accuracy through aggregated, anonymized domain-level signals (see below)</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Data Used to Improve Accuracy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground">BrowseAI Dev is not a fully private service.</strong> Queries and results processed through the hosted service are stored and used to improve accuracy for all users. We believe in being transparent about this. Here is exactly what we use and how:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
              <li><strong className="text-foreground">Query & result storage</strong> — Your queries, answers, claims, sources, and confidence scores are stored in our database. This data powers your query history, cached results, and the self-learning systems described below. Results are stored as long as your account is active (or until you delete them).</li>
              <li><strong className="text-foreground">Domain authority scores</strong> — We track how often claims from specific domains are successfully verified. Over time, this data adjusts domain trustworthiness scores via dynamic scoring. Only domain-level aggregates are computed (e.g., "wikipedia.org has an 82% verification rate across 500 queries").</li>
              <li><strong className="text-foreground">Self-learning pipeline</strong> — Verification thresholds, consensus scoring, and confidence weights automatically adapt based on aggregate query outcomes. For example, if a query type consistently shows low verification rates, the system adjusts its thresholds. This operates on aggregated patterns, not individual queries.</li>
              <li><strong className="text-foreground">Verification model training</strong> — We use anonymized claim-evidence pairs from verification results to train and improve our proprietary evidence verification models (small classifier models, not LLMs). These models determine whether a piece of evidence supports, refutes, or is unrelated to a claim. Training data consists of claim text paired with source evidence text and a verification label — no user identifiers, API keys, or IP addresses are included in training data. This is how our verification accuracy improves over time.</li>
              <li><strong className="text-foreground">Feedback-driven calibration</strong> — When you rate a result as "good", "bad", or "wrong", that feedback is used to calibrate confidence scores via feedback-driven calibration — ensuring that a reported 75% confidence means approximately 75% actual accuracy. Feedback is stored with the result.</li>
              <li><strong className="text-foreground">Co-citation & source usefulness</strong> — We analyze which domains frequently appear together and which sources contribute the most verified claims, to improve source ranking for future queries.</li>
              <li><strong className="text-foreground">Cache</strong> — Results are cached (5 min for news, 30 min for general) to improve response times. All users benefit from the cache.</li>
            </ul>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground">What we do NOT do:</strong> We do not sell your data. We do not share individual queries or results with third parties (beyond the search/LLM providers needed to process your request). We do not use your queries to train large language models (LLMs). Aggregate statistical improvements are computed from patterns across all queries — your individual queries are not exposed to other users.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This data flywheel is a core part of how BrowseAI Dev improves over time. By using the managed service, you benefit from the collective verification data of all users — making every result more accurate. <strong className="text-foreground">Your data stays private</strong> — individual queries are never exposed to other users, and we do not use your queries to train large language models. Only aggregate patterns and anonymized claim-evidence pairs are used to improve domain authority scores, verification accuracy, and our evidence verification models.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Data Sharing</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We do not sell your personal data. Your search queries are processed by our verification engine, which uses third-party search and LLM services internally. We do not share your account information with any third parties.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Data Storage & Security</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Data is stored in Supabase (PostgreSQL) with row-level security. API keys are encrypted at rest using AES-256-GCM. All connections use TLS. We retain query data for as long as your account is active. You can delete all your data at any time (see Your Rights below).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">API Keys</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              All API access requires a BrowseAI Dev API key (bai_xxx). Your API key is transmitted over HTTPS and used to authenticate requests. Keys are stored securely and can be regenerated or deleted from your dashboard at any time.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Your Rights (Including GDPR)</h2>
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              <li>Access your stored data via the dashboard (query history, usage stats)</li>
              <li>Delete your API keys at any time from the dashboard</li>
              <li><strong className="text-foreground">Delete all your data</strong> — Use <code className="text-xs bg-secondary px-1 py-0.5 rounded">DELETE /user/data</code> to permanently remove all your query results and API keys. This is irreversible.</li>
              <li>Export your query history via the API</li>
              <li>Request full account deletion by contacting us</li>
            </ul>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              Note: Deleting your data removes your individual query results and API keys. Aggregate statistics (domain authority scores, verification rates) that were computed from your queries cannot be individually reversed, as they are statistical aggregates across all users.
            </p>
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
