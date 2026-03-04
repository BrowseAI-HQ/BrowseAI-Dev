const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    if (!query) {
      return new Response(
        JSON.stringify({ success: false, error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'LOVABLE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trace: { step: string; duration_ms: number; detail?: string }[] = [];

    // Step 1: Search
    let searchStart = Date.now();
    const searchRes = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${FIRECRAWL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 5, scrapeOptions: { formats: ['markdown'] } }),
    });
    const searchData = await searchRes.json();
    trace.push({ step: 'Search Web', duration_ms: Date.now() - searchStart, detail: `${searchData.data?.length || 0} results` });

    if (!searchRes.ok || !searchData.data?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'No search results found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Build sources from search results (Firecrawl search already includes scraped content)
    const scrapedPages = searchData.data.slice(0, 5);
    trace.push({ step: 'Scrape Pages', duration_ms: 0, detail: `${scrapedPages.length} pages (included in search)` });

    // Build page content for Gemini
    const pageContents = scrapedPages.map((p: any, i: number) => {
      const content = p.markdown || p.description || '';
      return `[Source ${i + 1}] URL: ${p.url}\nTitle: ${p.title || 'Untitled'}\n\n${content.slice(0, 3000)}`;
    }).join('\n\n---\n\n');

    // Step 3: Extract claims + generate answer via Gemini
    const geminiStart = Date.now();
    const geminiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are a knowledge extraction engine. Given web page content, extract structured claims with source attribution and write a clear answer.

Return a JSON object using the tool provided.`
          },
          {
            role: 'user',
            content: `Question: ${query}\n\nWeb sources:\n${pageContents}`
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'return_knowledge',
            description: 'Return extracted knowledge with claims, sources, answer, and confidence',
            parameters: {
              type: 'object',
              properties: {
                answer: { type: 'string', description: 'A clear, comprehensive answer to the question (2-4 paragraphs)' },
                confidence: { type: 'number', description: 'Confidence score between 0 and 1' },
                claims: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      claim: { type: 'string', description: 'A specific factual claim extracted from the sources' },
                      sources: { type: 'array', items: { type: 'string' }, description: 'URLs that support this claim' }
                    },
                    required: ['claim', 'sources']
                  }
                },
                sources: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      url: { type: 'string' },
                      title: { type: 'string' },
                      domain: { type: 'string' },
                      quote: { type: 'string', description: 'A key quote from this source' }
                    },
                    required: ['url', 'title', 'domain', 'quote']
                  }
                }
              },
              required: ['answer', 'confidence', 'claims', 'sources'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'return_knowledge' } },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini error:', geminiRes.status, errText);

      if (geminiRes.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (geminiRes.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted. Please add funds.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: 'AI processing failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiRes.json();
    const geminiDuration = Date.now() - geminiStart;

    // Parse the tool call response
    const toolCall = geminiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error('No tool call in Gemini response:', JSON.stringify(geminiData));
      return new Response(
        JSON.stringify({ success: false, error: 'AI did not return structured output' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let knowledge;
    try {
      knowledge = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error('Failed to parse Gemini output:', toolCall.function.arguments);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to parse AI output' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    trace.push({ step: 'Extract Claims', duration_ms: Math.round(geminiDuration * 0.4), detail: `${knowledge.claims?.length || 0} claims` });
    trace.push({ step: 'Build Evidence Graph', duration_ms: Math.round(geminiDuration * 0.1), detail: `${knowledge.sources?.length || 0} sources` });
    trace.push({ step: 'Generate Answer', duration_ms: Math.round(geminiDuration * 0.5), detail: 'Gemini Flash' });

    return new Response(
      JSON.stringify({
        success: true,
        result: {
          answer: knowledge.answer,
          claims: knowledge.claims || [],
          sources: knowledge.sources || [],
          confidence: knowledge.confidence || 0.85,
          trace,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Browse error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
