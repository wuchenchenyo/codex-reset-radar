import { readFile } from "node:fs/promises";
import { createAnalyzer } from "../services/ai";
import { createRepository } from "../services/monitor/factory";
import { ResetEngine } from "../services/reset/engine";
import { makeManualPost } from "../services/social";

interface HistoryRecord {
  content: string;
  publishedAt: string;
  externalId?: string;
  url?: string;
}

async function main() {
  const file = process.argv[2] ?? "data/sample-history.json";
  const notify = process.argv.includes("--notify");
  const raw = JSON.parse(await readFile(file, "utf8")) as HistoryRecord[];
  const repo = createRepository();
  const analyzer = createAnalyzer();
  const engine = new ResetEngine(repo);

  for (const record of raw) {
    const post = makeManualPost({
      content: record.content,
      publishedAt: new Date(record.publishedAt),
      externalId: record.externalId,
    });
    if (record.url) post.url = record.url;
    const stored = await repo.upsertPost(post);
    let analysis = await repo.getCompletedAnalysisForPost(stored.post.id);
    if (!analysis) {
      const result = await analyzer.analyzePost(stored.post);
      analysis = await repo.saveCompletedAnalysis(stored.post.id, result, analyzer.model);
    }
    await engine.apply(stored.post, analysis);
  }

  if (notify) {
    console.info("Historical import complete. Live notifications were not sent unless --notify is implemented by a future provider.");
  }
  console.info(`Imported ${raw.length} posts.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
