import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Zap } from "lucide-react";

interface Stock {
  id: string;
  ticker: string;
  company_name: string;
  sector: string | null;
  current_price: number | null;
}

export default function Portfolio() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [riskLevel, setRiskLevel] = useState("moderate");
  const [selectedStock, setSelectedStock] = useState("");
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(false);
  const [tradingAgent, setTradingAgent] = useState(false);

  const fetchAll = async () => {
    if (!user) return;
    const [{ data: stocksData }, { data: portfoliosData }, { data: riskData }] = await Promise.all([
      supabase.from("stocks").select("*").order("ticker"),
      supabase.from("portfolios").select("*, stocks(ticker, company_name, current_price)").eq("user_id", user.id),
      supabase.from("risk_settings").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    setStocks(stocksData || []);
    setPortfolios(portfoliosData || []);
    if (riskData) setRiskLevel(riskData.risk_level);
  };

  useEffect(() => { fetchAll(); }, [user]);

  const addToPortfolio = async () => {
    if (!user || !selectedStock || !quantity) return;
    setLoading(true);
    const stock = stocks.find(s => s.id === selectedStock);
    const { error } = await supabase.from("portfolios").upsert({
      user_id: user.id,
      stock_id: selectedStock,
      quantity: Number(quantity),
      avg_buy_price: stock?.current_price || 0,
    }, { onConflict: "user_id,stock_id" });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Stock added to portfolio" });
      setSelectedStock("");
      setQuantity("");
      fetchAll();
    }
    setLoading(false);
  };

  const removeFromPortfolio = async (id: string) => {
    const { error } = await supabase.from("portfolios").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetchAll();
  };

  const updateRisk = async (level: string) => {
    if (!user) return;
    setRiskLevel(level);
    await supabase.from("risk_settings").upsert({ user_id: user.id, risk_level: level }, { onConflict: "user_id" });
  };

  const runTradingAgent = async () => {
    if (!user) return;
    setTradingAgent(true);
    try {
      const { data, error } = await supabase.functions.invoke("trading-agent", {
        body: { user_id: user.id },
      });
      if (error) throw error;
      toast({ title: "Trading Agent Complete", description: `Generated ${data?.orders_created || 0} trade suggestions` });
      fetchAll();
    } catch (e: any) {
      toast({ title: "Agent Failed", description: e.message, variant: "destructive" });
    }
    setTradingAgent(false);
  };

  const riskSliderValue = riskLevel === "conservative" ? 0 : riskLevel === "moderate" ? 50 : 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portfolio Management</h1>
          <p className="text-sm text-muted-foreground">Manage holdings & risk tolerance</p>
        </div>
        <Button size="sm" onClick={runTradingAgent} disabled={tradingAgent}>
          <Zap className={`h-4 w-4 mr-2 ${tradingAgent ? "animate-pulse" : ""}`} />
          {tradingAgent ? "Running Agent..." : "Run Trading Agent"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Add stock */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Add Stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={selectedStock} onValueChange={setSelectedStock}>
              <SelectTrigger><SelectValue placeholder="Select a stock" /></SelectTrigger>
              <SelectContent>
                {stocks.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.ticker} — {s.company_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Quantity" value={quantity} onChange={e => setQuantity(e.target.value)} min={1} />
            <Button className="w-full" onClick={addToPortfolio} disabled={loading || !selectedStock || !quantity}>
              <Plus className="h-4 w-4 mr-2" /> Add to Portfolio
            </Button>
          </CardContent>
        </Card>

        {/* Risk settings */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Risk Tolerance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Conservative</span>
              <Badge variant={riskLevel === "conservative" ? "default" : riskLevel === "moderate" ? "secondary" : "destructive"}>
                {riskLevel}
              </Badge>
              <span className="text-sm text-muted-foreground">Aggressive</span>
            </div>
            <Slider
              value={[riskSliderValue]}
              onValueChange={([v]) => {
                const level = v < 33 ? "conservative" : v < 66 ? "moderate" : "aggressive";
                updateRisk(level);
              }}
              max={100}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              {riskLevel === "conservative" && "Small positions, tight stop-losses. The agent will prefer holding cash."}
              {riskLevel === "moderate" && "Balanced approach. The agent will trade on strong sentiment signals."}
              {riskLevel === "aggressive" && "Large positions, wider risk bands. The agent will act on weaker signals."}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Holdings table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Current Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          {portfolios.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No holdings. Add stocks above to build your portfolio.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stock</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Avg Price</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">P&L</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {portfolios.map((p: any) => {
                  const current = p.stocks?.current_price || 0;
                  const value = p.quantity * current;
                  const pnl = (current - p.avg_buy_price) * p.quantity;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <span className="font-mono font-semibold">{p.stocks?.ticker}</span>
                        <p className="text-xs text-muted-foreground">{p.stocks?.company_name}</p>
                      </TableCell>
                      <TableCell className="text-right">{p.quantity}</TableCell>
                      <TableCell className="text-right font-mono">${p.avg_buy_price.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">${current.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">${value.toFixed(2)}</TableCell>
                      <TableCell className={`text-right font-mono ${pnl >= 0 ? "text-[hsl(var(--bullish))]" : "text-[hsl(var(--bearish))]"}`}>
                        {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeFromPortfolio(p.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
