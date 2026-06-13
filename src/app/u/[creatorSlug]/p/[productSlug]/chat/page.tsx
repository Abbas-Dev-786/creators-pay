"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { formatAmount } from "@/lib/money";

export default function ChatPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !sessionId) return;

    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          messages: newMessages,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chat request failed");

      setMessages([...newMessages, { role: "assistant", content: data.reply }]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!sessionId) {
    return <div className="p-10 text-center">Session ID is required</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 h-[calc(100vh-80px)] flex flex-col">
      <h1 className="text-2xl font-bold mb-4">AI Chat Session</h1>
      
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl p-4 flex flex-col gap-4">
        {messages.length === 0 && (
          <div className="text-center opacity-50 my-auto">
            Start a conversation! Each message deducts from your session budget.
          </div>
        )}
        
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-xl p-3 ${
              m.role === "user" 
                ? "bg-blue-600 text-white" 
                : "bg-gray-200 dark:bg-gray-800 text-black dark:text-white"
            }`}>
              <p className="whitespace-pre-wrap text-sm">{m.content}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}

      <form onSubmit={handleSend} className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask something..."
          className="flex-1 border rounded-lg p-3 dark:bg-black dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}
