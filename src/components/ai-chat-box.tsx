import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { streamAi, type ChatMsg } from "@/lib/ai-client";
import { ArrowUp, GraduationCap, Loader2, Paperclip, Square, Copy, Check } from "lucide-react";
import { toast } from "sonner";

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="my-3 rounded-lg overflow-hidden border border-border/80 bg-zinc-950 text-zinc-100 text-xs font-mono shadow-sm">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-zinc-400">
        <span className="uppercase text-[10px] tracking-wider font-semibold">{language || "code"}</span>
        <button
          onClick={copy}
          type="button"
          className="flex items-center gap-1 hover:text-zinc-100 transition-colors py-0.5 px-1.5 rounded hover:bg-zinc-800"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function CleanMarkdown({ content }: { content: string }) {
  // Strip out reasoning / <think> tags if emitted by model
  const cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => <h1 className="text-base font-bold text-foreground mt-4 mb-2 pb-1 border-b">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-semibold text-foreground mt-3 mb-1.5">{children}</h2>,
        h3: ({ children }) => <h3 className="text-xs font-semibold text-foreground mt-2 mb-1">{children}</h3>,
        p: ({ children }) => <p className="mb-2 leading-relaxed text-foreground/90 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="my-2 ml-4 list-disc space-y-1 text-foreground/90">{children}</ul>,
        ol: ({ children }) => <ol className="my-2 ml-4 list-decimal space-y-1 text-foreground/90">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed pl-1">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
        blockquote: ({ children }) => (
          <blockquote className="my-2 border-l-4 border-gold/70 bg-accent/30 pl-3 py-1 italic rounded-r text-muted-foreground">
            {children}
          </blockquote>
        ),
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || "");
          const codeString = String(children).replace(/\n$/, "");
          if (!inline && (match || codeString.includes("\n"))) {
            return <CodeBlock language={match ? match[1] : ""} code={codeString} />;
          }
          return (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-primary" {...props}>
              {children}
            </code>
          );
        },
        table: ({ children }) => (
          <div className="my-3 overflow-x-auto rounded border">
            <table className="w-full text-left text-xs border-collapse">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="border-b bg-muted/60 p-2 font-semibold">{children}</th>,
        td: ({ children }) => <td className="border-b p-2 border-muted/40">{children}</td>,
      }}
    >
      {cleaned}
    </ReactMarkdown>
  );
}

const suggestions = [
  "Plan my study week around my deadlines",
  "What's due soonest and how should I start?",
  "Make 5 practice quiz questions for my hardest course",
  "Draft a class announcement about next week's quiz",
];

export function AiChatBox({
  initial = [],
  onChange,
  compact,
  autoPrompt,
}: {
  initial?: ChatMsg[];
  onChange?: (msgs: ChatMsg[]) => void;
  compact?: boolean;
  autoPrompt?: string | undefined;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>(initial);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [attach, setAttach] = useState<{ name: string; text: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const autoSent = useRef(false);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { taRef.current?.focus(); }, [busy]);
  useEffect(() => {
    if (autoPrompt && !autoSent.current && initial.length === 0) {
      autoSent.current = true;
      send(autoPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrompt]);

  async function onFile(f: File) {
    try {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() });
      setAttach({ name: f.name, text: value.slice(0, 60000) });
    } catch {
      toast.error("Could not read that file. Please use a .docx file.");
    }
  }

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    const content = attach ? `${t}\n\n---\nAttached document "${attach.name}":\n${attach.text}` : t;
    const next: ChatMsg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setAttach(null);
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    let acc = "";
    setMessages([...next, { role: "assistant", content: "" }]);
    try {
      await streamAi(next, (d) => {
        acc += d;
        setMessages([...next, { role: "assistant", content: acc }]);
      }, ac.signal);
      const finalContent = acc.trim() || "I've processed your request. Please let me know if you would like me to solve or explain any specific part.";
      const final: ChatMsg[] = [...next, { role: "assistant", content: finalContent }];
      setMessages(final);
      onChange?.(final);
    } catch (e: any) {
      if (e?.name === "AbortError") {
        const final: ChatMsg[] = [...next, { role: "assistant", content: (acc || "") + "\n\n_(stopped)_" }];
        setMessages(final);
        onChange?.(final);
      } else {
        setMessages(next);
        toast.error(e?.message || "AI request failed");
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="mx-auto max-w-lg pt-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-gold text-gold-foreground">
              <GraduationCap className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-xl font-semibold">NUML Scholar</h3>
            <p className="mt-1 text-sm text-muted-foreground">I can see your courses and deadlines. Ask me anything.</p>
            <div className={`mt-6 grid gap-2 ${compact ? "" : "sm:grid-cols-2"}`}>
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-md border bg-card p-3 text-left text-sm hover:bg-accent">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-md rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                {m.content.split("\n\n---\nAttached document")[0]}
                {m.content.includes("\n\n---\nAttached document") && (
                  <div className="mt-1 text-xs opacity-75">📎 document attached</div>
                )}
              </div>
            </div>
          ) : (
            <div key={i} className="flex gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gold text-gold-foreground">
                <GraduationCap className="h-4 w-4" />
              </div>
              <div className="prose-chat min-w-0 flex-1 text-sm leading-relaxed">
                {m.content ? <CleanMarkdown content={m.content} /> : (
                  <span className="inline-flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Thinking…</span>
                )}
              </div>
            </div>
          ),
        )}
        <div ref={endRef} />
      </div>
      <div className="border-t p-3">
        {attach && (
          <div className="mb-2 flex items-center justify-between rounded-lg bg-muted px-3 py-1.5 text-xs">
            <span>📎 {attach.name}</span>
            <button onClick={() => setAttach(null)} className="text-muted-foreground hover:text-foreground">Remove</button>
          </div>
        )}
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex items-end gap-2 rounded-md border bg-card p-2"
        >
          <input ref={fileRef} type="file" accept=".docx" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <Button type="button" size="icon" variant="ghost" onClick={() => fileRef.current?.click()} aria-label="Attach DOCX">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Ask NUML Scholar…"
            rows={1}
            className="max-h-40 min-h-9 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          {busy ? (
            <Button type="button" size="icon" variant="secondary" onClick={() => abortRef.current?.abort()} aria-label="Stop">
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!input.trim()} aria-label="Send">
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
