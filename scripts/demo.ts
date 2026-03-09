import "dotenv/config";

const API_BASE = process.env.API_BASE || "http://localhost:3001";

const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

function c(color: keyof typeof COLORS, text: string) {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

async function apiCall<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `API call failed: ${res.status}`);
  }
  return data.result;
}

function hr() {
  console.log(c("dim", "  " + "\u2500".repeat(60)));
}

function section(title: string) {
  console.log();
  console.log(c("bold", `  ${title}`));
  hr();
}

async function demoSearch(query: string) {
  section("1. WEB SEARCH");
  console.log(c("gray", `  Query: "${query}"`));
  console.log();

  const start = Date.now();
  const result = await apiCall<any>("/browse/search", { query });
  const elapsed = Date.now() - start;

  console.log(c("green", `  Found ${result.results.length} results`) + c("gray", ` (${elapsed}ms)`));
  result.results.forEach((r: any, i: number) =>
    console.log(c("cyan", `  [${i + 1}]`) + ` ${r.title}`)
  );
}

async function demoAnswer(query: string) {
  section("2. FULL ANSWER PIPELINE");
  console.log(c("gray", `  search \u2192 scrape \u2192 extract \u2192 evidence graph \u2192 answer`));
  console.log();

  const start = Date.now();
  const result = await apiCall<any>("/browse/answer", { query });
  const elapsed = Date.now() - start;

  // Answer
  console.log(c("bold", `  Answer`) + c("gray", ` (${(elapsed / 1000).toFixed(1)}s)`));
  hr();
  const lines = result.answer.split("\n");
  lines.forEach((line: string) => console.log(`  ${line}`));

  // Confidence
  console.log();
  const pct = Math.round(result.confidence * 100);
  const bar = "\u2588".repeat(Math.round(pct / 5)) + "\u2591".repeat(20 - Math.round(pct / 5));
  console.log(c("green", `  Confidence: ${pct}%`) + c("gray", ` [${bar}]`));

  // Claims
  console.log();
  console.log(c("bold", `  Claims (${result.claims.length})`));
  result.claims.forEach((cl: any, i: number) => {
    console.log(c("yellow", `  [${i + 1}]`) + ` ${cl.claim}`);
    console.log(c("gray", `      Sources: ${cl.sources.length}`));
  });

  // Sources
  console.log();
  console.log(c("bold", `  Sources (${result.sources.length})`));
  result.sources.forEach((s: any, i: number) => {
    console.log(c("cyan", `  [${i + 1}]`) + ` ${s.title} ` + c("gray", `(${s.domain})`));
    if (s.quote) console.log(c("gray", `      "${s.quote.slice(0, 100)}..."`));
  });

  // Trace
  console.log();
  console.log(c("bold", `  Pipeline Trace`));
  result.trace.forEach((t: any) => {
    const ms = String(t.duration_ms).padStart(6);
    console.log(c("magenta", `  ${t.step.padEnd(22)}`) + c("cyan", `${ms}ms`) + c("gray", `  ${t.detail || ""}`));
  });
  const total = result.trace.reduce((s: number, t: any) => s + t.duration_ms, 0);
  console.log(c("green", `  ${"Total".padEnd(22)}${String(total).padStart(6)}ms`));

  // Share link
  if (result.shareId) {
    console.log();
    console.log(c("blue", `  Shareable link: `) + `http://localhost:8080/share/${result.shareId}`);
  }

  return result;
}

async function demoCompare(query: string) {
  section("3. COMPARE: RAW LLM vs EVIDENCE-BACKED");
  console.log(c("gray", `  Running both pipelines in parallel...`));
  console.log();

  const start = Date.now();
  const result = await apiCall<any>("/browse/compare", { query });
  const elapsed = Date.now() - start;

  console.log(c("gray", `  Completed in ${(elapsed / 1000).toFixed(1)}s`));
  console.log();

  // Stats comparison
  console.log(
    c("red", `  RAW LLM`) +
    c("gray", `    Sources: 0  Claims: 0  Confidence: ?`)
  );
  console.log(
    c("green", `  BROWSE AI`) +
    c("gray", `  Sources: ${result.evidence_backed.sources}  Claims: ${result.evidence_backed.claims}  Confidence: ${Math.round(result.evidence_backed.confidence * 100)}%`)
  );

  // Raw answer preview
  console.log();
  console.log(c("red", `  Raw LLM Answer:`));
  console.log(c("gray", `  ${result.raw_llm.answer.slice(0, 300)}...`));

  // Evidence answer preview
  console.log();
  console.log(c("green", `  Evidence-Backed Answer:`));
  console.log(`  ${result.evidence_backed.answer.slice(0, 300)}...`);

  // Citations
  if (result.evidence_backed.citations?.length > 0) {
    console.log();
    console.log(c("green", `  Citations (only available with Browse AI):`));
    result.evidence_backed.citations.slice(0, 5).forEach((s: any, i: number) => {
      console.log(c("cyan", `  [${i + 1}]`) + ` ${s.title} ` + c("gray", `(${s.domain})`));
    });
  }
}

async function main() {
  const query = process.argv[2] || "What causes aurora borealis?";
  const mode = process.argv[3] || "all";

  console.log();
  console.log(c("bold", `  Browse AI Demo`));
  console.log(c("gray", `  Open-source deep research for AI agents`));
  hr();
  console.log(c("gray", `  Query: `) + c("cyan", `"${query}"`));

  try {
    if (mode === "all" || mode === "search") {
      await demoSearch(query);
    }
    if (mode === "all" || mode === "answer") {
      await demoAnswer(query);
    }
    if (mode === "all" || mode === "compare") {
      await demoCompare(query);
    }

    console.log();
    hr();
    console.log(c("green", `  Demo complete!`));
    console.log(c("gray", `  Web UI:  http://localhost:8080`));
    console.log(c("gray", `  Compare: http://localhost:8080/compare?q=${encodeURIComponent(query)}`));
    console.log(c("gray", `  API:     ${API_BASE}`));
    console.log(c("gray", `  MCP:     npx browse-ai setup`));
    console.log();
  } catch (err: any) {
    console.error();
    console.error(c("red", `  Error: ${err.message}`));
    console.error(c("gray", `  Make sure the API server is running: npx pnpm dev`));
    process.exit(1);
  }
}

main();
