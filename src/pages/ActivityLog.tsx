import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface OrderLog {
  id: string;
  order_type: string;
  quantity: number;
  price: number;
  status: string;
  reasoning: string | null;
  ai_drafted: boolean | null;
  created_at: string;
  ticker: string;
}

export default function ActivityLog() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderLog[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("orders")
      .select("*, stocks(ticker)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setOrders((data || []).map((o: any) => ({ ...o, ticker: o.stocks?.ticker || "" })));
      });
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Agent Activity Log</h1>
        <p className="text-sm text-muted-foreground">Timeline of all AI trading decisions and reasoning</p>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No agent activity yet. Run the trading agent from the Portfolio page.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map(o => (
            <Card key={o.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                    o.order_type === "buy" ? "bg-[hsl(var(--bullish))]/10 text-[hsl(var(--bullish))]" : "bg-[hsl(var(--bearish))]/10 text-[hsl(var(--bearish))]"
                  }`}>
                    {o.order_type === "buy" ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold">{o.ticker}</span>
                      <Badge variant={o.order_type === "buy" ? "default" : "destructive"}>{o.order_type.toUpperCase()}</Badge>
                      <Badge variant="secondary">{o.status}</Badge>
                      {o.ai_drafted && <Badge variant="outline" className="text-xs">AI</Badge>}
                      <span className="text-xs text-muted-foreground ml-auto">{new Date(o.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm mt-1">
                      {o.quantity} shares @ ${o.price.toFixed(2)} = <span className="font-mono font-semibold">${(o.quantity * o.price).toFixed(2)}</span>
                    </p>
                    {o.reasoning && (
                      <p className="text-sm text-muted-foreground mt-2 bg-muted p-2 rounded-md">{o.reasoning}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
