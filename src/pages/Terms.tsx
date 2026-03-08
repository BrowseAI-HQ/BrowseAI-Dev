import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <nav className="flex items-center gap-4 px-4 sm:px-8 py-5 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
          <img src="/logo.svg" alt="BrowseAI" className="w-4 h-4" />
          <span className="font-semibold text-sm">BrowseAI Dev</span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">Last updated: March 8, 2026</p>
        </div>

        <div className="prose prose-invert prose-sm max-w-none space-y-6">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">1. Acceptance of Terms</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              By using BrowseAI Dev ("the Service"), including the website at browseai.dev, the REST API, MCP server, and Python SDK, you agree to these terms. If you don't agree, don't use the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">2. What the Service Does</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              BrowseAI Dev provides AI-powered research infrastructure: web search with evidence extraction, structured citations, and confidence scoring. Results are generated from real-time web searches and LLM processing. We do not guarantee the accuracy, completeness, or timeliness of any results.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">3. Accounts</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You may use the Service without an account (subject to demo rate limits). Creating an account gives you access to API key management, query history, and higher usage limits. You are responsible for maintaining the security of your account and API keys.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">4. API Keys & Usage</h2>
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              <li>You may use your own API keys (BYOK) for unlimited access at no cost.</li>
              <li>BrowseAI API keys (bai_xxx) are personal and should not be shared publicly.</li>
              <li>Demo access is limited to 5 queries per hour per IP address.</li>
              <li>We reserve the right to revoke API keys that are abused or used in violation of these terms.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">5. Acceptable Use</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              <li>Use the Service for any illegal purpose</li>
              <li>Attempt to circumvent rate limits or access controls</li>
              <li>Use the Service to generate spam, misinformation, or harmful content</li>
              <li>Reverse engineer the hosted API (the source code is open — just read it)</li>
              <li>Overwhelm the Service with excessive automated requests beyond reasonable use</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">6. Open Source License</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The BrowseAI Dev source code is licensed under the MIT License. You are free to self-host, modify, and redistribute the code under the terms of that license. These Terms of Service apply specifically to the hosted service at browseai.dev.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">7. Third-Party Services</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The Service relies on third-party APIs including Tavily (web search) and OpenRouter (LLM processing). Your use of these services through BrowseAI Dev is also subject to their respective terms. We are not responsible for the availability or performance of third-party services.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">8. Disclaimer of Warranties</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The Service is provided "as is" without warranties of any kind. Research results are AI-generated and may contain inaccuracies. Confidence scores are algorithmic estimates, not guarantees. Always verify critical information from primary sources.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">9. Limitation of Liability</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              To the maximum extent permitted by law, BrowseAI Dev and its contributors shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">10. Changes to Terms</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may update these terms. Continued use of the Service after changes constitutes acceptance. Material changes will be communicated via the website or email.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">11. Contact</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Questions about these terms? Email{" "}
              <a href="mailto:shreyassaw@gmail.com" className="text-accent hover:underline">shreyassaw@gmail.com</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Terms;
