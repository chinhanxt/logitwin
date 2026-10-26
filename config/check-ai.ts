import { Repository } from "../src/core/database.ts";
import { RagService } from "../src/core/rag.ts";
import { writeFileSync } from "node:fs";
const repo = new Repository(":memory:");
repo.seed();
try {
  const rag = new RagService(repo),
    actor = { id: "integration-planner", tenant: "demo-chain", role: "planner" as const };
  const start = Date.now();
  const indexed = await rag.index(actor);
  const answer = await rag.ask(actor, "Quy trình điều chuyển và nhận hàng cần kiểm tra những gì?");
  const receipt = {
    indexed,
    mode: answer.mode,
    model: answer.model,
    numericCheck: answer.numericCheck,
    sources: answer.sources.map((s) => ({ id: s.id, title: s.title, version: s.version, score: s.score })),
    answer: answer.answer,
    ms: Date.now() - start,
  };
  writeFileSync("docs/ai-validation.json", JSON.stringify(receipt, null, 2));
  console.log(
    JSON.stringify({
      indexed,
      mode: answer.mode,
      model: answer.model,
      numericCheck: answer.numericCheck,
      sources: answer.sources.length,
      ms: receipt.ms,
    }),
  );
  if (!answer.sources.length) process.exitCode = 1;
} finally {
  repo.close();
}
