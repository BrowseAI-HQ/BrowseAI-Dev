# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | Yes                |

## Reporting a Vulnerability

If you discover a security vulnerability in BrowseAI Dev, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email security concerns or report via [GitHub Security Advisories](https://github.com/BrowseAI-HQ/BrowseAI-Dev/security/advisories/new).

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response timeline

- **Acknowledgment:** Within 48 hours
- **Assessment:** Within 1 week
- **Fix:** Critical issues patched within 2 weeks

## Security Practices

- **No secrets in code:** All API keys are loaded from environment variables. Never commit `.env` files.
- **Encryption:** User API keys stored with AES-256-GCM encryption.
- **Input validation:** All API inputs validated with Zod schemas.
- **Rate limiting:** 5 requests/hour per IP for unauthenticated demo usage.
- **SSRF protection:** URL allowlist prevents requests to localhost and private IPs.
- **RLS policies:** Supabase Row Level Security ensures users can only access their own data.

## BAI Key Security

All API access requires a BrowseAI Dev API key (`bai_xxx` prefix). Your BAI key:
- Should be kept secret and never committed to source control
- Is stored encrypted with AES-256-GCM if saved server-side
- Can be rotated at any time from the dashboard at [browseai.dev/dashboard](https://browseai.dev/dashboard)
- Should be set via the `BROWSE_API_KEY` environment variable for MCP and SDK usage
