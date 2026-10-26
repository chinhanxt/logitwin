import { test } from "node:test";
import assert from "node:assert/strict";
import { Repository } from "../src/core/database.ts";
import { DecisionService } from "../src/modules/logistics/decisions.ts";
import { planRoutes } from "../src/modules/logistics/routing.ts";
import { cosine, checkNumericTokens, RagService } from "../src/core/rag.ts";
import type { Actor } from "../src/core/contracts.ts";
const planner: Actor = { id: "p", tenant: "demo-chain", role: "planner" },
  approver: Actor = { id: "a", tenant: "demo-chain", role: "approver" };
test("routing respects capacity/time, pickup-before-dropoff and tenant isolation", () => {
  const repo = new Repository(":memory:");
  repo.seed();
  try {
    const service = new DecisionService(repo);
    service.generate(planner);
    for (const d of repo.decisions(planner.tenant).filter((d) => d.kind === "transfer")) {
      service.transition(approver, d.id, "approve");
      service.transition(approver, d.id, "execute");
    }
    const normal = planRoutes(repo, planner, { capacityKg: 25, maxMinutes: 90, speedKph: 20 });
    assert.ok(normal.stops.length > 0);
    assert.ok(normal.minutes <= 90);
    for (let i = 0; i < normal.stops.length; i += 2) {
      assert.equal(normal.stops[i].action, "pickup");
      assert.equal(normal.stops[i + 1].action, "dropoff");
      assert.equal(normal.stops[i].movement, normal.stops[i + 1].movement);
      assert.ok(normal.stops[i].loadKg <= 25);
      assert.equal(normal.stops[i + 1].loadKg, 0);
    }
    const limited = planRoutes(repo, planner, { capacityKg: 1, maxMinutes: 10, speedKph: 5 });
    assert.ok(limited.unassigned.length > 0);
    assert.equal(planRoutes(repo, { ...planner, tenant: "other-chain" }, { capacityKg: 25, maxMinutes: 90, speedKph: 20 }).stops.length, 0);
    assert.throws(() => planRoutes(repo, planner, { capacityKg: NaN, maxMinutes: 90, speedKph: 20 }), /Sức chứa/);
  } finally {
    repo.close();
  }
});
test("numeric grounding rejects invented numbers; cosine scores are not confidence", () => {
  assert.equal(checkNumericTokens("Cần 20 đơn vị", ["Tồn 20 đơn vị"]), true);
  assert.equal(checkNumericTokens("Độ tin cậy 95%", ["Tồn 20 đơn vị"]), false);
  assert.equal(checkNumericTokens("Nhiệt độ -20", ["Nhiệt độ 20"]), false);
  assert.equal(cosine([1, 0], [1, 0]), 1);
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.equal(cosine([], []), 0);
});
test("RAG with no tenant-indexed evidence returns no answer without calling a model", async () => {
  const repo = new Repository(":memory:");
  repo.seed();
  try {
    const rag = new RagService(repo);
    const answer = await rag.ask({ ...planner, tenant: "other-chain" }, "Quy trình nhận hàng?");
    assert.equal(answer.mode, "no-evidence");
    assert.equal(answer.sources.length, 0);
  } finally {
    repo.close();
  }
});
test('RAG rejects invented numeric tokens and reports embedding outages as 503',async(t)=>{
 const repo=new Repository(':memory:');repo.seed();try{
 const doc=repo.db.prepare('SELECT id FROM documents WHERE tenant=? LIMIT 1').get(planner.tenant)!;
 repo.db.prepare('INSERT INTO embeddings VALUES(?,?,?,?,?,?,?,?)').run('vector-1',planner.tenant,doc.id!,1,'Tồn kho có 10 đơn vị.',JSON.stringify([1,0]),'bge-m3:latest',new Date().toISOString());
 const rag=new RagService(repo);
 t.mock.method(globalThis,'fetch',async(input:unknown)=>new Response(JSON.stringify(String(input).endsWith('/embed')?{embeddings:[[1,0]]}:{response:JSON.stringify({answer:'Tồn kho có 20 đơn vị.',citations:[doc.id]})}),{status:200}));
 const answer=await rag.ask(planner,'Có bao nhiêu tồn kho?');assert.equal(answer.mode,'source-excerpt');assert.equal(rag.active,0);
 t.mock.method(globalThis,'fetch',async()=>{throw new Error('offline');});
 await assert.rejects(rag.ask(planner,'Có bao nhiêu tồn kho?'),(error:unknown)=>typeof error==='object'&&error!==null&&'status' in error&&error.status===503);assert.equal(rag.active,0);
 }finally{repo.close();}
});
test('RAG bounds concurrent requests and releases slots on client cancellation',async(t)=>{
 const repo=new Repository(':memory:');repo.seed();try{
 const doc=repo.db.prepare('SELECT id FROM documents WHERE tenant=? LIMIT 1').get(planner.tenant)!;
 repo.db.prepare('INSERT INTO embeddings VALUES(?,?,?,?,?,?,?,?)').run('vector-1',planner.tenant,doc.id!,1,'Quy trình mẫu.',JSON.stringify([1,0]),'bge-m3:latest',new Date().toISOString());
 t.mock.method(globalThis,'fetch',async(_input:unknown,init?:RequestInit)=>new Promise((_resolve,reject)=>{init?.signal?.addEventListener('abort',()=>reject(new Error('cancelled')),{once:true});}));
 const rag=new RagService(repo),controller=new AbortController();
 const first=rag.ask(planner,'Quy trình mẫu nào?',controller.signal),second=rag.ask(planner,'Kiểm tra quy trình?',controller.signal);
 await assert.rejects(rag.ask(planner,'Yêu cầu thứ ba?'),(e:unknown)=>typeof e==='object'&&e!==null&&'status' in e&&e.status===429);
 controller.abort();await Promise.allSettled([first,second]);assert.equal(rag.active,0);
 }finally{repo.close();}
});
