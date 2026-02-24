"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { FileText, Send, Upload, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: { filename: string; content: string; similarity: number }[];
}

interface DocEntry {
  filename: string;
  createdAt: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [docs, setDocs] = useState<DocEntry[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDocs();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchDocs() {
    try {
      const res = await fetch("/api/upload");
      if (res.ok) {
        const data = await res.json();
        setDocs(data.docs ?? []);
      }
    } catch {
      // silent
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        await fetchDocs();
      } else {
        const err = await res.json();
        alert(err.error ?? "Upload failed");
      }
    } catch {
      alert("Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSend() {
    const query = input.trim();
    if (!query || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: query }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.answer,
            sources: data.sources,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Something went wrong. Please try again." },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Network error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-800 px-8 py-5">
        <h1 className="text-2xl font-bold text-white">Chat with your documents</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Upload ERCOT reports, tariff sheets, or any market document and ask questions.
        </p>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — documents */}
        <aside className="flex w-64 flex-shrink-0 flex-col gap-3 border-r border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Documents
          </p>

          <ScrollArea className="flex-1">
            {docs.length === 0 ? (
              <p className="text-xs text-zinc-500">No documents uploaded yet.</p>
            ) : (
              <ul className="space-y-1">
                {docs.map((doc) => (
                  <li
                    key={doc.filename}
                    className="flex items-start gap-2 rounded-md px-2 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
                  >
                    <FileText className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-cyan-400" />
                    <span className="break-all">{doc.filename}</span>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.csv,.txt"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="mr-2 h-3.5 w-3.5" />
            )}
            {uploading ? "Uploading…" : "Upload file"}
          </Button>
        </aside>

        {/* Right panel — chat */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <ScrollArea className="flex-1 px-6 py-4">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-zinc-500">
                  Upload a document and ask a question to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-xl px-4 py-3 text-sm ${
                        msg.role === "user"
                          ? "bg-cyan-600 text-white"
                          : "bg-zinc-800 text-zinc-100"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {msg.sources.map((src, j) => (
                            <Badge
                              key={j}
                              variant="outline"
                              className="border-zinc-600 bg-zinc-900 text-xs text-zinc-400"
                              title={src.content}
                            >
                              {src.filename}{" "}
                              <span className="ml-1 text-cyan-400">
                                {(src.similarity * 100).toFixed(0)}%
                              </span>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                      <span className="text-sm text-zinc-400">Thinking…</span>
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input row */}
          <div className="border-t border-zinc-800 px-6 py-4">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question about your documents…"
                className="flex-1 border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 focus-visible:ring-cyan-500"
                disabled={loading}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="bg-cyan-600 hover:bg-cyan-500 text-white"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
