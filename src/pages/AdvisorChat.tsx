import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquarePlus, Send } from "lucide-react";

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

const objectives = [
  "Automate sentiment-driven trading decisions",
  "Monitor market sentiment in real-time",
  "Adjust portfolio risk dynamically",
  "Demonstrate agentic trading logic",
];

const requirements = [
  "News and social media sentiment analysis",
  "Mock portfolio management",
  "Risk level adjustment algorithm",
  "Buy/sell order drafting logic",
];

const deliverables = [
  "Sentiment trading agent",
  "Portfolio management dashboard",
  "Demo with mock market data",
  "Sentiment analysis documentation",
];

export default function AdvisorChat() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  const loadSessions = async () => {
    if (!user) return [] as ChatSession[];

    const { data, error } = await supabase
      .from("chat_sessions")
      .select("id,title,created_at,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      toast({ title: "Unable to load chat sessions", description: error.message, variant: "destructive" });
      return [];
    }

    const nextSessions = (data ?? []) as ChatSession[];
    setSessions(nextSessions);

    if (!activeSessionId && nextSessions.length > 0) {
      setActiveSessionId(nextSessions[0].id);
    }

    return nextSessions;
  };

  const loadMessages = async (sessionId: string) => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id,session_id,role,content,created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) {
      toast({ title: "Unable to load messages", description: error.message, variant: "destructive" });
      return [] as ChatMessage[];
    }

    const nextMessages = (data ?? []) as ChatMessage[];
    setMessages(nextMessages);
    return nextMessages;
  };

  useEffect(() => {
    loadSessions();
  }, [user]);

  useEffect(() => {
    if (activeSessionId) {
      loadMessages(activeSessionId);
      return;
    }
    setMessages([]);
  }, [activeSessionId]);

  const createSession = async () => {
    if (!user || creatingSession) return;
    setCreatingSession(true);

    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .insert({ user_id: user.id, title: `Session ${new Date().toLocaleDateString()}` })
        .select("id,title,created_at,updated_at")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      setSessions((prev) => [data as ChatSession, ...prev]);
      setActiveSessionId((data as ChatSession).id);
      setMessages([]);
    } catch (error) {
      toast({
        title: "Could not create session",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setCreatingSession(false);
    }
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !activeSessionId || !prompt.trim() || sending) return;

    const sentPrompt = prompt.trim();
    setPrompt("");
    setSending(true);

    try {
      const { error: insertUserError } = await supabase.from("chat_messages").insert({
        session_id: activeSessionId,
        user_id: user.id,
        role: "user",
        content: sentPrompt,
      });

      if (insertUserError) {
        throw new Error(insertUserError.message);
      }

      await supabase
        .from("chat_sessions")
        .update({ title: sentPrompt.slice(0, 45) })
        .eq("id", activeSessionId);

      const conversation = await loadMessages(activeSessionId);
      const payloadMessages = conversation.map((message) => ({ role: message.role, content: message.content }));

      const { data, error } = await supabase.functions.invoke("advisor-chat", {
        body: { messages: payloadMessages },
      });

      if (error || data?.error) {
        throw new Error(error?.message || data?.error || "Advisor response failed");
      }

      if (!data?.content || typeof data.content !== "string") {
        throw new Error("Advisor returned an invalid response");
      }

      const { error: insertAssistantError } = await supabase.from("chat_messages").insert({
        session_id: activeSessionId,
        user_id: user.id,
        role: "assistant",
        content: data.content,
      });

      if (insertAssistantError) {
        throw new Error(insertAssistantError.message);
      }

      await loadSessions();
      await loadMessages(activeSessionId);
    } catch (error) {
      toast({
        title: "Advisor chat error",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      setPrompt(sentPrompt);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">1:1 Trading Advisor</h1>
        <p className="text-sm text-muted-foreground">Session-based chat for real LLM guided sentiment-trading decisions.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ObjectiveCard title="Key Objectives" items={objectives} />
        <ObjectiveCard title="Requirements" items={requirements} />
        <ObjectiveCard title="Deliverables" items={deliverables} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Sessions</CardTitle>
            <Button size="sm" variant="outline" onClick={createSession} disabled={creatingSession}>
              {creatingSession ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <MessageSquarePlus className="h-4 w-4 mr-1" />}
              New
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground">Create your first one-on-one advisor session.</p>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.id}
                  className={`w-full text-left rounded-md p-2 text-sm transition-colors ${
                    activeSessionId === session.id ? "bg-accent" : "hover:bg-muted"
                  }`}
                  onClick={() => setActiveSessionId(session.id)}
                >
                  <p className="font-medium truncate">{session.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(session.updated_at).toLocaleString()}</p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>{activeSession?.title || "Select a session"}</span>
              <Badge variant="secondary">Real LLM target proximity: 95%</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[420px] rounded-md border p-3 mb-3">
              <div className="space-y-3">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Ask how to integrate sentiment analysis, risk adjustment, and order drafting logic.
                  </p>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-[85%] rounded-lg p-3 text-sm ${
                        message.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      {message.content}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            <form className="flex gap-2" onSubmit={sendMessage}>
              <Input
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={activeSessionId ? "Ask the advisor..." : "Create a session first"}
                disabled={!activeSessionId || sending}
              />
              <Button type="submit" disabled={!activeSessionId || !prompt.trim() || sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ObjectiveCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div key={item} className="text-sm text-muted-foreground">
            • {item}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
