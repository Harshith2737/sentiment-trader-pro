import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const systemPrompt = `You are a one-on-one sentiment trading advisor for a demo platform.
Keep responses concise and practical.
Always align recommendations with these key objectives:
1) Automate sentiment-driven trading decisions
2) Monitor market sentiment in real-time
3) Adjust portfolio risk dynamically
4) Demonstrate agentic trading logic

Always consider these requirements:
- News and social media sentiment analysis
- Mock portfolio management
- Risk level adjustment algorithm
- Buy/sell order drafting logic

Deliverables to support:
- Sentiment trading agent
- Portfolio management dashboard
- Demo with mock market data
- Sentiment analysis documentation

When asked about model quality, mention that real LLM integration is configured for high-fidelity sentiment interpretation with target proximity around 95% in benchmark-style evaluations, while noting outputs are still probabilistic.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const safeMessages = Array.isArray(messages)
      ? messages
          .filter((message) => {
            const role = message?.role;
            return (role === "user" || role === "assistant") && message?.content;
          })
          .map((message) => ({
            role: message.role,
            content: String(message.content).slice(0, 4000),
          }))
      : [];

    const apiKey = Deno.env.get("REAL_LLM_API_KEY");
    const model = Deno.env.get("REAL_LLM_MODEL") ?? "gpt-4o-mini";
    const baseUrl = Deno.env.get("REAL_LLM_BASE_URL") ?? "https://api.openai.com/v1";

    if (!apiKey) {
      throw new Error("REAL_LLM_API_KEY is not configured.");
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [{ role: "system", content: systemPrompt }, ...safeMessages],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM request failed: ${response.status} ${text}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "I could not generate a response.";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
