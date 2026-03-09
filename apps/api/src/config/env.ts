import { z } from "zod";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env from project root (two levels up from apps/api/)
config({ path: resolve(process.cwd(), "../../.env") });
// Also try loading from CWD (for standalone usage)
config();

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3001),
  SERP_API_KEY: z.string().min(1, "SERP_API_KEY (Tavily) is required"),
  OPENROUTER_API_KEY: z.string().min(1, "OPENROUTER_API_KEY is required"),
  REDIS_URL: z.string().optional(),
  CORS_ORIGIN: z.string().default("http://localhost:8080"),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  API_KEY_ENCRYPTION_KEY: z.string().trim().transform(v => v || undefined).pipe(z.string().length(64).optional()),
  SUPABASE_JWT_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

async function fetchSupabaseSecrets(
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<Record<string, string>> {
  try {
    const res = await fetch(
      `${supabaseUrl}/functions/v1/get-secrets`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ keys: ["SERP_API_KEY", "OPENROUTER_API_KEY"] }),
      }
    );
    if (!res.ok) {
      console.warn("Could not fetch secrets from Supabase:", res.status);
      return {};
    }
    return await res.json();
  } catch (e) {
    console.warn("Supabase secrets fetch failed, using env vars:", e);
    return {};
  }
}

export async function loadEnv(): Promise<Env> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // If API keys are empty, try fetching from Supabase
  if (
    supabaseUrl &&
    serviceRoleKey &&
    (!process.env.SERP_API_KEY || !process.env.OPENROUTER_API_KEY)
  ) {
    console.log("Fetching API keys from Supabase secrets...");
    const secrets = await fetchSupabaseSecrets(supabaseUrl, serviceRoleKey);
    if (secrets.SERP_API_KEY) process.env.SERP_API_KEY = secrets.SERP_API_KEY;
    if (secrets.OPENROUTER_API_KEY)
      process.env.OPENROUTER_API_KEY = secrets.OPENROUTER_API_KEY;
  }

  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Environment validation failed:");
    console.error(result.error.format());
    throw new Error("Environment validation failed: " + JSON.stringify(result.error.format()));
  }
  return result.data;
}
