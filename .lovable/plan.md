

# Stock Market Sentiment Agentic Trader

## 1. Authentication & User Onboarding
- **Google Sign-In** via Supabase Auth (Gmail verification as requested)
- **Email/password** signup as fallback
- Protected routes — unauthenticated users redirected to login
- User profiles table storing display name and preferences

## 2. Database Schema (Supabase)
- **profiles** — user info linked to auth
- **stocks** — ticker symbols, company names, sector (20+ pre-seeded stocks)
- **portfolios** — user's holdings (stock, quantity, avg buy price)
- **orders** — buy/sell order history with timestamps and reasoning
- **sentiment_logs** — sentiment scores per stock from news/social analysis
- **risk_settings** — user's current risk level and thresholds
- Row-Level Security so each user only sees their own data

## 3. Sentiment Analysis Engine (Edge Functions + Lovable AI)
- **News sentiment function** — fetches real headlines via NewsAPI, sends to Lovable AI (GPT-5) for sentiment scoring (-1 to +1)
- **Social media mock feed** — simulated tweets/posts about stocks, also analyzed by AI
- Returns per-stock sentiment scores stored in `sentiment_logs`
- Scheduled to run periodically (or triggered on-demand from dashboard)

## 4. Agentic Trading Logic (Edge Function)
- Reads latest sentiment scores for portfolio stocks
- Applies risk adjustment algorithm:
  - Bearish sentiment → reduce position / draft sell orders
  - Bullish sentiment → increase position / draft buy orders
  - Neutral → hold
- Considers user's risk tolerance setting (conservative/moderate/aggressive)
- Generates draft orders with AI-written reasoning for each trade decision
- Orders saved to database for user review/approval

## 5. Real-Time Stock Data (Edge Function)
- Fetches live/delayed stock prices from Alpha Vantage (free tier)
- Updates portfolio valuations
- Provides price history for charts

## 6. Main Dashboard
- **Portfolio overview** — total value, daily P&L, allocation pie chart
- **Holdings table** — each stock with current price, sentiment score, gain/loss
- **Sentiment gauge** — overall market sentiment indicator
- **Risk level indicator** — current portfolio risk with adjustment controls
- **Recent orders** — list of AI-drafted buy/sell orders with approve/reject actions

## 7. Sentiment Analysis View
- Per-stock sentiment breakdown (news vs social)
- Sentiment trend charts over time (using Recharts)
- Latest analyzed headlines and social posts with their scores
- Color-coded sentiment indicators (green/yellow/red)

## 8. Trading Agent Activity Log
- Timeline of all agent decisions and reasoning
- "Why did the agent do this?" explanations powered by AI
- Filter by stock, action type, or date

## 9. Portfolio Management
- Add/remove stocks from watchlist
- Adjust risk tolerance slider (conservative ↔ aggressive)
- Manual buy/sell capability alongside AI suggestions
- Portfolio performance charts over time

## 10. Design & UX
- Clean, professional finance dashboard aesthetic (dark theme option)
- Responsive layout for demo on projector or laptop
- Real-time data refresh indicators
- Toast notifications for new AI trade suggestions

