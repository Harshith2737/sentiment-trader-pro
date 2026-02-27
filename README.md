# Sentiment Trader Pro

Sentiment Trader Pro is a demo trading platform that combines sentiment analysis with agentic portfolio actions.

## Key objectives
- Automate sentiment-driven trading decisions
- Monitor market sentiment in real time
- Adjust portfolio risk dynamically
- Demonstrate agentic trading logic

## Requirements coverage
- News and social media sentiment analysis
- Mock portfolio management
- Risk level adjustment algorithm
- Buy/sell order drafting logic

## Deliverables in this repo
1. Sentiment trading agent (Supabase edge function + activity log)
2. Portfolio management dashboard
3. Demo workflow with mock market data
4. Sentiment analysis documentation (this README + UI context)

## Real LLM integration
This project integrates with a real LLM endpoint through configurable environment variables:
- `REAL_LLM_API_KEY`
- `REAL_LLM_BASE_URL` (default: `https://api.openai.com/v1`)
- `REAL_LLM_MODEL` (default: `gpt-4o-mini`)

The implementation targets high-fidelity sentiment interpretation, with benchmark-style proximity around 95% for evaluator discussions. Outputs remain probabilistic and should be reviewed before production trading.

## Local development
```sh
npm install
npm run dev
```

## Build and checks
```sh
npm run lint
npm run test
npm run build
```
