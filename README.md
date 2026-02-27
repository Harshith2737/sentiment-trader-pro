# Sentiment Trader Pro

**Real-time Stock Market Sentiment Analysis & Agentic Trading Dashboard**

A modern web application that visualizes market sentiment from news and social sources, analyzes it using AI, and provides actionable trading insights with dynamic portfolio risk adjustment.

Built as a clean, responsive frontend prototype for demonstrating sentiment-driven trading decisions.

## Features

- Real-time sentiment scoring and visualization
- Dynamic portfolio risk level adjustment based on sentiment signals
- Color-coded indicators (bullish/green, bearish/red, neutral/yellow)
- Clean, modern UI with dark mode support
- Interactive charts and data tables
- Mock data integration (easy to swap with real APIs)

## Tech Stack

- **Frontend Framework**: React + TypeScript
- **Build Tool & Dev Server**: Vite
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS
- **Icons & Utilities**: Lucide React
- **Fonts**: Inter (sans-serif), JetBrains Mono (code)

## Quick Start (Local Development)

### Prerequisites

- Node.js 18+ (recommended: use nvm)
- npm or Bun (Bun is significantly faster)

### Steps

1. Clone the repository
   ```bash
   git clone https://github.com/Harshith2737/sentiment-trader-pro.git
   cd sentiment-trader-pro

Install dependenciesBash# Using npm
npm install

# OR using Bun (recommended for speed)
bun install
Start the development serverBash# npm
npm run dev

# OR Bun
bun run dev→ Open http://localhost:5173 (or the port shown in terminal)
(Optional) Build for productionBashnpm run build
# output appears in /dist folder

Project Structure (Key Folders & Files)
textsentiment-trader-pro/
├── public/               # static assets (favicon, images)
├── src/
│   ├── components/       # shadcn/ui + custom UI components
│   ├── lib/              # utilities, helpers, constants
│   ├── hooks/            # custom React hooks
│   ├── pages/            # or app/ – main views/routes
│   ├── App.tsx           # root component
│   ├── main.tsx          # entry point
│   └── index.css         # global styles + Tailwind + theme variables
├── tailwind.config.ts
├── tsconfig.json
├── vite.config.ts
└── package.json
Customization & Extension Points

Theme colors: Edit CSS variables in src/index.css (--bullish, --bearish, --neutral, --primary, etc.)
Fonts: Already using Inter + JetBrains Mono – change in @import at top of index.css
Adding components: Use shadcn CLIBashnpx shadcn-ui@latest add card button table chart
Real data integration: Replace mock data fetches with APIs like Finnhub, Alpha Vantage, or NewsAPI in your data hooks/services.

Deployment (Recommended Platforms)

Vercel (easiest & fastest)
Connect GitHub repo → auto deploys on push
Build command: npm run build
Output directory: dist

Netlify / Render / Cloudflare Pages
Similar setup: link repo, set build command & publish dir

Custom domain (after deploy)
Add domain in hosting dashboard
Update DNS (CNAME or A record)


License
MIT License – feel free to fork, modify, and use for personal or educational purposes.
Made With
❤️ React · Vite · TypeScript · Tailwind · shadcn/ui
Happy trading insights!
Built in Hyderabad 🇮🇳