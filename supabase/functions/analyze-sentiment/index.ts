import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const llmKey = Deno.env.get("REAL_LLM_API_KEY")!;
    const llmBaseUrl = Deno.env.get("REAL_LLM_BASE_URL") ?? "https://api.openai.com/v1";
    const llmModel = Deno.env.get("REAL_LLM_MODEL") ?? "gpt-4o-mini";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all stocks
    const { data: stocks } = await supabase.from("stocks").select("id, ticker, company_name");
    if (!stocks || stocks.length === 0) {
      return new Response(JSON.stringify({ analyzed: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Pick 5 random stocks to analyze (to stay within rate limits)
    const shuffled = stocks.sort(() => Math.random() - 0.5).slice(0, 5);
    let analyzed = 0;

    for (const stock of shuffled) {
      // Use AI to generate sentiment analysis
      const prompt = `You are a financial sentiment analyst. Analyze the current market sentiment for ${stock.ticker} (${stock.company_name}).

Generate a realistic mock news headline and sentiment analysis. Return a JSON object with exactly these fields:
- news_headline: a realistic news headline about this stock
- news_sentiment: a score from -1.0 (very bearish) to 1.0 (very bullish)  
- social_headline: a realistic social media post about this stock
- social_sentiment: a score from -1.0 to 1.0
- news_summary: brief explanation of the news sentiment (1 sentence)
- social_summary: brief explanation of the social sentiment (1 sentence)

Return ONLY valid JSON, no markdown.`;

      const aiResponse = await fetch(`${llmBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${llmKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: llmModel,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!aiResponse.ok) {
        console.error(`AI error for ${stock.ticker}:`, aiResponse.status);
        continue;
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || "";
      
      // Parse JSON from response
      let parsed;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch?.[0] || content);
      } catch {
        console.error(`Failed to parse AI response for ${stock.ticker}`);
        continue;
      }

      // Insert sentiment logs
      await supabase.from("sentiment_logs").insert([
        {
          stock_id: stock.id,
          source: "news",
          sentiment_score: Math.max(-1, Math.min(1, parsed.news_sentiment || 0)),
          headline: parsed.news_headline || `${stock.ticker} market update`,
          summary: parsed.news_summary || "",
        },
        {
          stock_id: stock.id,
          source: "social",
          sentiment_score: Math.max(-1, Math.min(1, parsed.social_sentiment || 0)),
          headline: parsed.social_headline || `${stock.ticker} trending`,
          summary: parsed.social_summary || "",
        },
      ]);

      analyzed++;
    }

    return new Response(JSON.stringify({ analyzed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Sentiment analysis error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
