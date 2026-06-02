"use client";

import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Zap,
  ArrowUp,
  Paperclip,
  Sparkles,
  BarChart3,
  TrendingUp,
  Lightbulb,
  Target,
  ChevronRight,
  Bot,
  User,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
} from "lucide-react";
import { AnswerChart, EvidencePanel, type ChartSpec, type Step } from "@/components/assistant/answer-extras";

// ─── Suggested prompts ──────────────────────────────────────────────────────

const SUGGESTIONS = [
  { icon: BarChart3, label: "Channel ROAS", prompt: "Which channels have the highest ROAS? Show me a chart." },
  { icon: TrendingUp, label: "Top Campaigns", prompt: "What are my top 5 campaigns by revenue, and what's their CPL?" },
  { icon: Lightbulb, label: "Budget Efficiency", prompt: "Compare cost-per-lead across channels and tell me where I'm overspending." },
  { icon: Target, label: "Spend Trend", prompt: "Show me total weekly spend and revenue over the last 8 weeks." },
];

// ─── Types ──────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  chart?: ChartSpec | null;
  steps?: Step[];
  error?: boolean;
}

const WELCOME_MESSAGES: Message[] = [];

function renderMarkdown(content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n\|(.+)\|/g, (_, row) => {
      const cells = row.split("|").map((c: string) => c.trim());
      return `<tr>${cells.map((c: string) => `<td>${c}</td>`).join("")}</tr>`;
    })
    .replace(/\n- /g, "</p><li>")
    .replace(/\n(\d+)\. /g, "</p><li>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>");
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>(WELCOME_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setIsTyping(true);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();

      const aiMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: res.ok
          ? data.answer ?? "I couldn't produce an answer."
          : `**Something went wrong.** ${data.error ?? "Please try again."}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        chart: res.ok ? data.chart ?? null : null,
        steps: res.ok ? data.steps ?? [] : [],
        error: !res.ok,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: `**Connection error.** ${err instanceof Error ? err.message : "Please try again."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          error: true,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="-m-8 flex flex-col h-[calc(100vh-57px)] bg-background overflow-hidden">
      {/* Messages area */}
      <div className="flex-1 overflow-auto">
        {isEmpty ? (
          /* ─── Empty state ─── */
          <div className="flex flex-col items-center justify-center h-full px-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal/20 to-emerald-500/10 border border-teal/20 flex items-center justify-center mb-6">
              <Zap className="h-8 w-8 text-teal" />
            </div>
            <h1 className="text-2xl font-bold mb-2">STRATIS Assistant</h1>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-10">
              Your AI-powered media strategist. Ask about campaign performance, budget efficiency, or channel ROAS — answers are queried live from your campaign data.
            </p>

            {/* Suggestion cards */}
            <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => sendMessage(s.prompt)}
                  className="group flex items-start gap-3 p-4 rounded-xl bg-card border border-border/30 hover:border-teal/30 hover:bg-teal/5 transition-all text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-muted/50 border border-border/20 flex items-center justify-center shrink-0 group-hover:bg-teal/10 group-hover:border-teal/20 transition-colors">
                    <s.icon className="h-4 w-4 text-muted-foreground group-hover:text-teal transition-colors" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground mb-0.5">{s.label}</p>
                    <p className="text-[11px] text-muted-foreground/70 line-clamp-2">{s.prompt}</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-teal/50 shrink-0 mt-1 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ─── Conversation ─── */
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex gap-3", msg.role === "user" && "justify-end")}>
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal/20 to-emerald-500/10 border border-teal/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-4 w-4 text-teal" />
                  </div>
                )}
                <div className={cn("max-w-[85%] min-w-0", msg.role === "user" && "order-first")}>
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      msg.role === "user"
                        ? "bg-teal text-white rounded-br-md"
                        : "bg-card border border-border/30 rounded-bl-md"
                    )}
                  >
                    {msg.role === "assistant" ? (
                      <>
                        <div
                          className="prose prose-sm prose-invert max-w-none
                            [&_strong]:text-foreground [&_strong]:font-semibold
                            [&_p]:text-muted-foreground [&_p]:mb-3 [&_p:last-child]:mb-0
                            [&_li]:text-muted-foreground [&_li]:mb-1
                            [&_table]:text-[12px] [&_th]:text-foreground [&_th]:font-semibold [&_th]:pb-2 [&_th]:pr-4 [&_th]:text-left
                            [&_td]:text-muted-foreground [&_td]:py-1.5 [&_td]:pr-4
                            [&_h2]:text-foreground [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mb-2 [&_h2]:mt-4
                            [&_code]:text-teal [&_code]:bg-teal/10 [&_code]:px-1 [&_code]:rounded"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                        />
                        {msg.chart && <AnswerChart spec={msg.chart} />}
                        {msg.steps && msg.steps.length > 0 && <EvidencePanel steps={msg.steps} />}
                      </>
                    ) : (
                      <p>{msg.content}</p>
                    )}
                  </div>
                  {/* Message actions */}
                  <div className={cn("flex items-center gap-1 mt-1.5 px-1", msg.role === "user" && "justify-end")}>
                    <span className="text-[10px] text-muted-foreground/40 mr-2">{msg.timestamp}</span>
                    {msg.role === "assistant" && (
                      <>
                        <button className="p-1 rounded text-muted-foreground/30 hover:text-muted-foreground transition-colors">
                          <Copy className="h-3 w-3" />
                        </button>
                        <button className="p-1 rounded text-muted-foreground/30 hover:text-muted-foreground transition-colors">
                          <ThumbsUp className="h-3 w-3" />
                        </button>
                        <button className="p-1 rounded text-muted-foreground/30 hover:text-muted-foreground transition-colors">
                          <ThumbsDown className="h-3 w-3" />
                        </button>
                        <button className="p-1 rounded text-muted-foreground/30 hover:text-muted-foreground transition-colors">
                          <RotateCcw className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-lg bg-muted/50 border border-border/20 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal/20 to-emerald-500/10 border border-teal/20 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-teal" />
                </div>
                <div className="bg-card border border-border/30 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-teal/60 animate-bounce [animation-delay:0ms]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-teal/60 animate-bounce [animation-delay:150ms]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-teal/60 animate-bounce [animation-delay:300ms]" />
                    </div>
                    <span className="text-[11px] text-muted-foreground/50">Querying your data…</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ─── Input bar ─── */}
      <div className="border-t border-border/30 bg-card/50 backdrop-blur-sm px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 bg-card border border-border/40 rounded-2xl px-4 py-3 shadow-lg shadow-black/10 focus-within:border-teal/30 transition-colors">
            <button className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/30 transition-colors shrink-0 mb-0.5">
              <Paperclip className="h-4 w-4" />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask STRATIS anything about your campaigns..."
              rows={1}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none resize-none max-h-[120px]"
              style={{ height: "auto", minHeight: "24px" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
              }}
            />
            <div className="flex items-center gap-1.5 shrink-0 mb-0.5">
              <button className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                <Sparkles className="h-3 w-3" />
                STRATIS AI
              </button>
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isTyping}
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
                  input.trim() && !isTyping
                    ? "bg-teal text-white hover:bg-teal/90"
                    : "bg-muted/50 text-muted-foreground/30"
                )}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/30 text-center mt-2">
            STRATIS AI queries live campaign data. Verify important decisions with your team.
          </p>
        </div>
      </div>
    </div>
  );
}
