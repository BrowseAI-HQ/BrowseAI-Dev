import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify the request has a valid authorization header
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.slice(7);

  // Verify the token is a service_role key by checking the JWT payload
  // Service role JWTs have role: "service_role", anon JWTs have role: "anon"
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.role !== "service_role") {
      return new Response(JSON.stringify({ error: "Forbidden: service_role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { keys } = await req.json();
    if (!Array.isArray(keys)) {
      return new Response(JSON.stringify({ error: "keys must be an array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowedKeys: string[] = [];
    const secrets: Record<string, string> = {};

    for (const key of keys) {
      if (allowedKeys.includes(key)) {
        const value = Deno.env.get(key);
        if (value) secrets[key] = value;
      }
    }

    return new Response(JSON.stringify(secrets), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
