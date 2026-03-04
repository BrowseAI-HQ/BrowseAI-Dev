const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify the request has a valid service role key
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
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

    const allowedKeys = ["SERP_API_KEY", "OPENROUTER_API_KEY"];
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
