"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const samples = [
  "Reset coming tomorrow.",
  "Everyone gets another reset.",
  "Banked reset is available.",
  "Codex got faster today.",
  "Something fun tomorrow 👀",
];

export function IngestForm() {
  const [content, setContent] = useState(samples[0]);
  const [secret, setSecret] = useState("");
  const [result, setResult] = useState<string | null>(null);

  async function submit() {
    const response = await fetch("/api/dev/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ content }),
    });
    const json = await response.json();
    setResult(JSON.stringify(json, null, 2));
  }

  return (
    <div className="max-w-xl space-y-4 rounded-xl border border-border/80 p-5">
      <div className="flex flex-wrap gap-2">
        {samples.map((sample) => (
          <button
            key={sample}
            type="button"
            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setContent(sample)}
          >
            {sample}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        <Label htmlFor="content">Post</Label>
        <textarea
          id="content"
          className="min-h-28 w-full rounded-lg border border-input bg-background p-3 text-sm"
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="secret">CRON_SECRET</Label>
        <Input
          id="secret"
          type="password"
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
        />
      </div>
      <Button type="button" onClick={() => void submit()}>
        Run pipeline
      </Button>
      {result ? (
        <pre className="overflow-x-auto rounded-lg bg-muted/50 p-3 font-mono text-xs">{result}</pre>
      ) : null}
    </div>
  );
}
