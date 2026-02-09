"use client";

import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import SnakeGame from "./components/SnakeGame";

type State = "idle" | "loading" | "success" | "error";

export default function Home() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<State>("idle");
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = url.trim();
      if (!trimmed) return;
      setState("loading");
      setError(null);
      setMarkdown(null);
      try {
        const res = await fetch("/api/brand-guide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmed }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error ?? "Request failed");
          setState("error");
          return;
        }
        setMarkdown(data.markdown ?? "");
        setState("success");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
        setState("error");
      }
    },
    [url]
  );

  const handleCopy = useCallback(async () => {
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy failed");
    }
  }, [markdown]);

  return (
    <main className="space-y-8">
      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <label htmlFor="url" className="mb-2 block text-sm font-medium text-slate-700">
          Homepage URL
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            disabled={state === "loading"}
          />
          <button
            type="submit"
            disabled={state === "loading"}
            className="rounded-lg bg-slate-800 px-5 py-2.5 font-medium text-white transition hover:bg-slate-700 disabled:opacity-60 disabled:hover:bg-slate-800"
          >
            {state === "loading" ? "Creating…" : "Create Brand Guide"}
          </button>
        </div>
      </form>

      {state === "loading" && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="mb-4 text-center text-sm text-slate-600">
            Building your brand guide… play while you wait
          </p>
          <div className="flex justify-center">
            <SnakeGame />
          </div>
        </section>
      )}

      {state === "error" && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {state === "success" && markdown && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3">
            <h2 className="text-sm font-semibold text-slate-700">Brand guide preview</h2>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {copied ? "Copied" : "Copy Markdown"}
            </button>
          </div>
          <div className="prose prose-slate max-w-none px-6 py-6 prose-headings:font-semibold prose-h2:font-bold prose-h3:font-bold prose-p:leading-relaxed prose-ul:my-3 prose-li:my-0.5">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          </div>
        </section>
      )}
    </main>
  );
}
