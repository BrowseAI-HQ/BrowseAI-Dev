import { buildApp } from "./app.js";
import { loadEnv } from "./config/env.js";

async function main() {
  const env = await loadEnv();
  const app = await buildApp();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
