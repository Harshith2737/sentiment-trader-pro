import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { RefreshCw, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface SentimentEntry {
  id: string;
  stock_id: string;
  source: string;
  sentiment_score: number;
  headline: string | null;
  summary: string | null;
  analyzed_at: string;
  ticker?: string;
}

export default function Sentiment() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<SentimentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("sentiment_logs")
      .select("*, stocks(ticker)")
      .order("analyzed_at", { ascending: false })
      .limit(100);
    setLogs((data || []).map((d: any) => ({ ...d, ticker: d.stocks?.ticker })));
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-sentiment");
      if (error) throw error;
      toast({ title: "Analysis Complete", description: `Analyzed ${data?.analyzed || 0} stocks` });
      fetchLogs();
    } catch (e: any) {
      toast({ title: "Analysis Failed", description: e.message, variant: "destructive" });
    }
    setAnalyzing(false);
  };

  // Build chart data grouped by stock
  const stockMap = new Map<string, { ticker: string; scores: { time: string; score: number }[] }>();
  logs.forEach(l => {
    if (!l.ticker) return;
    if (!stockMap.has(l.ticker)) stockMap.set(l.ticker, { ticker: l.ticker, scores: [] });
    stockMap.get(l.ticker)!.scores.push({ time: new Date(l.analyzed_at).toLocaleDateString(), score: l.sentiment_score });
  });

  const chartStocks = Array.from(stockMap.values()).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sentiment Analysis</h1>
          <p className="text-sm text-muted-foreground">AI-powered news & social sentiment scoring</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={runAnalysis} disabled={analyzing}>
            <Zap className={`h-4 w-4 mr-2 ${analyzing ? "animate-pulse" : ""}`} />
            {analyzing ? "Analyzing..." : "Run Analysis"}
          </Button>
        </div>
      </div>

      {/* Sentiment trend charts */}
      {chartStocks.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {chartStocks.map(s => (
            <Card key={s.ticker}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono">{s.ticker}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={s.scores.reverse()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                    <YAxis domain={[-1, 1]} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Sentiment log table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Recent Sentiment Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No sentiment data yet. Click "Run Analysis" to start.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stock</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Headline</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.slice(0, 30).map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono font-semibold">{l.ticker || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{l.source}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`font-mono font-semibold ${l.sentiment_score > 0.2 ? "text-[hsl(var(--bullish))]" : l.sentiment_score < -0.2 ? "text-[hsl(var(--bearish))]" : "text-[hsl(var(--neutral))]"}`}>
                        {l.sentiment_score > 0 ? "+" : ""}{l.sentiment_score.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate text-sm">{l.headline || l.summary || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(l.analyzed_at).toLocaleString()}</TableCell>
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
