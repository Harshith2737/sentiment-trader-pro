
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Stocks table (public read, no user write)
CREATE TABLE public.stocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  sector TEXT,
  current_price NUMERIC DEFAULT 0,
  price_change_pct NUMERIC DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view stocks" ON public.stocks FOR SELECT USING (true);

-- Pre-seed 25 stocks
INSERT INTO public.stocks (ticker, company_name, sector, current_price) VALUES
('AAPL', 'Apple Inc.', 'Technology', 178.50),
('MSFT', 'Microsoft Corporation', 'Technology', 378.90),
('GOOGL', 'Alphabet Inc.', 'Technology', 141.80),
('AMZN', 'Amazon.com Inc.', 'Consumer Cyclical', 178.25),
('NVDA', 'NVIDIA Corporation', 'Technology', 875.30),
('META', 'Meta Platforms Inc.', 'Communication', 505.75),
('TSLA', 'Tesla Inc.', 'Consumer Cyclical', 175.20),
('JPM', 'JPMorgan Chase & Co.', 'Financial', 198.45),
('V', 'Visa Inc.', 'Financial', 279.60),
('JNJ', 'Johnson & Johnson', 'Healthcare', 156.30),
('WMT', 'Walmart Inc.', 'Consumer Defensive', 175.80),
('PG', 'Procter & Gamble Co.', 'Consumer Defensive', 162.40),
('MA', 'Mastercard Inc.', 'Financial', 468.90),
('HD', 'The Home Depot Inc.', 'Consumer Cyclical', 365.20),
('DIS', 'Walt Disney Co.', 'Communication', 112.50),
('BAC', 'Bank of America Corp.', 'Financial', 35.80),
('XOM', 'Exxon Mobil Corp.', 'Energy', 104.60),
('PFE', 'Pfizer Inc.', 'Healthcare', 28.45),
('NFLX', 'Netflix Inc.', 'Communication', 625.40),
('INTC', 'Intel Corporation', 'Technology', 43.20),
('AMD', 'Advanced Micro Devices', 'Technology', 178.90),
('CRM', 'Salesforce Inc.', 'Technology', 298.50),
('COST', 'Costco Wholesale Corp.', 'Consumer Defensive', 725.30),
('ADBE', 'Adobe Inc.', 'Technology', 578.60),
('NKE', 'Nike Inc.', 'Consumer Cyclical', 98.75);

-- Portfolios table
CREATE TABLE public.portfolios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_id UUID NOT NULL REFERENCES public.stocks(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 0,
  avg_buy_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, stock_id)
);

ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own portfolios" ON public.portfolios FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own portfolios" ON public.portfolios FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own portfolios" ON public.portfolios FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own portfolios" ON public.portfolios FOR DELETE USING (auth.uid() = user_id);

-- Orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_id UUID NOT NULL REFERENCES public.stocks(id) ON DELETE CASCADE,
  order_type TEXT NOT NULL CHECK (order_type IN ('buy', 'sell')),
  quantity NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed')),
  reasoning TEXT,
  ai_drafted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_at TIMESTAMPTZ
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own orders" ON public.orders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own orders" ON public.orders FOR DELETE USING (auth.uid() = user_id);

-- Sentiment logs table (readable by all authenticated users)
CREATE TABLE public.sentiment_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stock_id UUID NOT NULL REFERENCES public.stocks(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('news', 'social')),
  sentiment_score NUMERIC NOT NULL CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
  headline TEXT,
  summary TEXT,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sentiment_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view sentiment" ON public.sentiment_logs FOR SELECT USING (auth.uid() IS NOT NULL);

-- Risk settings table
CREATE TABLE public.risk_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  risk_level TEXT NOT NULL DEFAULT 'moderate' CHECK (risk_level IN ('conservative', 'moderate', 'aggressive')),
  max_position_pct NUMERIC DEFAULT 10,
  stop_loss_pct NUMERIC DEFAULT 5,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.risk_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own risk settings" ON public.risk_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own risk settings" ON public.risk_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own risk settings" ON public.risk_settings FOR UPDATE USING (auth.uid() = user_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_portfolios_updated_at BEFORE UPDATE ON public.portfolios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_risk_settings_updated_at BEFORE UPDATE ON public.risk_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
