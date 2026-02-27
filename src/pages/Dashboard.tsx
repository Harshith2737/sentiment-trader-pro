import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, DollarSign, PieChart, Activity, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useToast } from "@/hooks/use-toast";

const COLORS = ["hsl(142,60%,40%)", "hsl(200,70%,50%)", "hsl(45,90%,55%)", "hsl(280,60%,55%)", "hsl(0,72%,55%)", "hsl(170,50%,45%)", "hsl(30,80%,50%)", "hsl(320,60%,50%)"];

interface HoldingWithStock {
  id: string;
  quantity: number;
  avg_buy_price: number;
  stock_id: string;
  ticker: string;
  company_name: string;
  current_price: number;
  price_change_pct: number;
  sentiment_score: number | null;
}

interface OrderWithStock {
  id: string;
  order_type: string;
  quantity: number;
  price: number;
  status: string;
  reasoning: string | null;
  ai_drafted: boolean | null;
  created_at: string;
  ticker: string;
  company_name: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [holdings, setHoldings] = useState<HoldingWithStock[]>([]);
  const [orders, setOrders] = useState<OrderWithStock[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    // Fetch portfolios with stock data
    const { data: portfolios } = await supabase
      .from("portfolios")
      .select("id, quantity, avg_buy_price, stock_id, stocks(ticker, company_name, current_price, price_change_pct)")
      .eq("user_id", user.id);

    // Fetch latest sentiment per stock
    const { data: sentiments } = await supabase
      .from("sentiment_logs")
      .select("stock_id, sentiment_score")
      .order("analyzed_at", { ascending: false });

    const sentimentMap = new Map<string, number>();
    sentiments?.forEach(s => {
      if (!sentimentMap.has(s.stock_id)) sentimentMap.set(s.stock_id, s.sentiment_score);
    });

    const holdingsData: HoldingWithStock[] = (portfolios || []).map((p: any) => ({
      id: p.id,
      quantity: p.quantity,
      avg_buy_price: p.avg_buy_price,
      stock_id: p.stock_id,
      ticker: p.stocks?.ticker || "",
      company_name: p.stocks?.company_name || "",
      current_price: p.stocks?.current_price || 0,
      price_change_pct: p.stocks?.price_change_pct || 0,
      sentiment_score: sentimentMap.get(p.stock_id) ?? null,
    }));
    setHoldings(holdingsData);

    // Fetch pending orders
    const { data: ordersData } = await supabase
      .from("orders")
      .select("id, order_type, quantity, price, status, reasoning, ai_drafted, created_at, stocks(ticker, company_name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    setOrders(
      (ordersData || []).map((o: any) => ({
        ...o,
        ticker: o.stocks?.ticker || "",
        company_name: o.stocks?.company_name || "",
      }))
    );

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const totalValue = holdings.reduce((sum, h) => sum + h.quantity * h.current_price, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.quantity * h.avg_buy_price, 0);
  const totalPnL = totalValue - totalCost;
  const pnlPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  const avgSentiment = holdings.length > 0
    ? holdings.filter(h => h.sentiment_score !== null).reduce((sum, h) => sum + (h.sentiment_score || 0), 0) /
      Math.max(holdings.filter(h => h.sentiment_score !== null).length, 1)
    : 0;

  const pieData = holdings.map(h => ({ name: h.ticker, value: h.quantity * h.current_price }));

  const handleOrder = async (orderId: string, action: "approved" | "rejected") => {
    const { error } = await supabase.from("orders").update({ status: action }).eq("id", orderId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: action === "approved" ? "Order Approved" : "Order Rejected" });
      fetchData();
    }
  };

  const sentimentLabel = avgSentiment > 0.2 ? "Bullish" : avgSentiment < -0.2 ? "Bearish" : "Neutral";
  const sentimentColor = avgSentiment > 0.2 ? "text-[hsl(var(--bullish))]" : avgSentiment < -0.2 ? "text-[hsl(var(--bearish))]" : "text-[hsl(var(--neutral))]";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Portfolio overview & AI trade suggestions</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<DollarSign />} label="Portfolio Value" value={`$${totalValue.toLocaleString("en", { minimumFractionDigits: 2 })}`} />
        <StatCard
          icon={totalPnL >= 0 ? <TrendingUp /> : <TrendingDown />}
          label="Total P&L"
          value={`${totalPnL >= 0 ? "+" : ""}$${totalPnL.toLocaleString("en", { minimumFractionDigits: 2 })}`}
          sub={`${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%`}
          positive={totalPnL >= 0}
        />
        <StatCard icon={<Activity />} label="Market Sentiment" value={sentimentLabel} className={sentimentColor} />
        <StatCard icon={<PieChart />} label="Holdings" value={`${holdings.length} stocks`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Holdings table */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Holdings</CardTitle>
          </CardHeader>
          <CardContent>
            {holdings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No holdings yet. Go to Portfolio to add stocks.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stock</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">P&L</TableHead>
                    <TableHead className="text-right">Sentiment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.map(h => {
                    const pnl = (h.current_price - h.avg_buy_price) * h.quantity;
                    return (
                      <TableRow key={h.id}>
                        <TableCell>
                          <div>
                            <span className="font-mono font-semibold">{h.ticker}</span>
                            <p className="text-xs text-muted-foreground">{h.company_name}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">${h.current_price.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{h.quantity}</TableCell>
                        <TableCell className={`text-right font-mono ${pnl >= 0 ? "text-[hsl(var(--bullish))]" : "text-[hsl(var(--bearish))]"}`}>
                          {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {h.sentiment_score !== null ? (
                            <SentimentBadge score={h.sentiment_score} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Allocation pie */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <RechartsPie>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name }) => name}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                </RechartsPie>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Recent AI Trade Suggestions</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No orders yet. Run the sentiment analysis to generate trade suggestions.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stock</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Reasoning</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map(o => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono font-semibold">{o.ticker}</TableCell>
                    <TableCell>
                      <Badge variant={o.order_type === "buy" ? "default" : "destructive"}>
                        {o.order_type.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{o.quantity}</TableCell>
                    <TableCell className="text-right font-mono">${o.price.toFixed(2)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{o.reasoning || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={o.status === "pending" ? "secondary" : o.status === "approved" ? "default" : "destructive"}>
                        {o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {o.status === "pending" && (
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-[hsl(var(--bullish))]" onClick={() => handleOrder(o.id, "approved")}>
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-[hsl(var(--bearish))]" onClick={() => handleOrder(o.id, "rejected")}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, sub, positive, className }: { icon: React.ReactNode; label: string; value: string; sub?: string; positive?: boolean; className?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center text-accent-foreground">{icon}</div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-lg font-bold font-mono ${className || ""}`}>{value}</p>
            {sub && <p className={`text-xs font-mono ${positive ? "text-[hsl(var(--bullish))]" : "text-[hsl(var(--bearish))]"}`}>{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SentimentBadge({ score }: { score: number }) {
  const label = score > 0.2 ? "Bullish" : score < -0.2 ? "Bearish" : "Neutral";
  const color = score > 0.2 ? "bg-[hsl(var(--bullish))]/10 text-[hsl(var(--bullish))]" : score < -0.2 ? "bg-[hsl(var(--bearish))]/10 text-[hsl(var(--bearish))]" : "bg-[hsl(var(--neutral))]/10 text-[hsl(var(--neutral))]";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{label}</span>;
}
