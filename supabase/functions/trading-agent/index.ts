import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user_id } = await req.json();
    if (!user_id) throw new Error("user_id required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user's portfolio
    const { data: portfolios } = await supabase
      .from("portfolios")
      .select("*, stocks(id, ticker, company_name, current_price)")
      .eq("user_id", user_id);

    if (!portfolios || portfolios.length === 0) {
      return new Response(JSON.stringify({ orders_created: 0, message: "No holdings in portfolio" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get risk settings
    const { data: riskData } = await supabase
      .from("risk_settings")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    const riskLevel = riskData?.risk_level || "moderate";

    // Get latest sentiment for portfolio stocks
    const stockIds = portfolios.map((p: any) => p.stock_id);
    const { data: sentiments } = await supabase
      .from("sentiment_logs")
      .select("stock_id, sentiment_score, source")
      .in("stock_id", stockIds)
      .order("analyzed_at", { ascending: false })
      .limit(50);

    // Average sentiment per stock
    const sentimentMap = new Map<string, number[]>();
    sentiments?.forEach((s: any) => {
      if (!sentimentMap.has(s.stock_id)) sentimentMap.set(s.stock_id, []);
      sentimentMap.get(s.stock_id)!.push(s.sentiment_score);
    });

    const avgSentiments = new Map<string, number>();
    sentimentMap.forEach((scores, stockId) => {
      avgSentiments.set(stockId, scores.reduce((a, b) => a + b, 0) / scores.length);
    });

    // Build context for AI
    const holdingsInfo = portfolios.map((p: any) => {
      const avgSent = avgSentiments.get(p.stock_id);
      return `${p.stocks.ticker}: ${p.quantity} shares @ $${p.stocks.current_price}, avg sentiment: ${avgSent?.toFixed(2) ?? "unknown"}`;
    }).join("\n");

    const prompt = `You are an agentic trading AI. Based on the current portfolio and sentiment data, generate trade recommendations.

Risk Level: ${riskLevel}
Portfolio:
${holdingsInfo}

Rules based on risk level "${riskLevel}":
- Conservative: Only trade on strong signals (sentiment > 0.5 or < -0.5). Small quantities.
- Moderate: Trade on moderate signals (> 0.3 or < -0.3). Medium quantities.
- Aggressive: Trade on weak signals (> 0.15 or < -0.15). Larger quantities.

For each recommendation, return a JSON array of objects with:
- ticker: stock ticker
- action: "buy" or "sell"
- quantity: number of shares
- reasoning: 1-2 sentence explanation

Generate 0-3 recommendations. If no clear signal, return empty array.
Return ONLY valid JSON array, no markdown.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "[]";

    let recommendations;
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      recommendations = JSON.parse(jsonMatch?.[0] || content);
    } catch {
      recommendations = [];
    }

    // Create orders
    let ordersCreated = 0;
    for (const rec of recommendations) {
      const stock = portfolios.find((p: any) => p.stocks.ticker === rec.ticker);
      if (!stock) continue;

      await supabase.from("orders").insert({
        user_id,
        stock_id: stock.stock_id,
        order_type: rec.action,
        quantity: Math.max(1, Math.round(rec.quantity)),
        price: stock.stocks.current_price,
        status: "pending",
        reasoning: rec.reasoning,
        ai_drafted: true,
      });
      ordersCreated++;
    }

    return new Response(JSON.stringify({ orders_created: ordersCreated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Trading agent error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
