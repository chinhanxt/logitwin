import { Engine } from "bpmn-engine";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const source = readFileSync(new URL("./workflows/decision.bpmn", import.meta.url), "utf8");
let preparedCommands = 0;
const services = {
  isApproved: () => true,
  isExecuteRequested: () => true,
  prepareCommand: (_scope: unknown, callback: (error: Error | null) => void) => {
    preparedCommands++;
    callback(null);
  },
};
const engine = new Engine({ source, settings: { enableDummyService: false }, services });
let execution = await engine.execute();
assert.equal(execution.getPostponed()[0]?.id, "review");
execution.signal({ id: "review" });
assert.equal(execution.getPostponed()[0]?.id, "execute");
const checkpoint = JSON.parse(JSON.stringify(execution.getState()));
execution = await new Engine({ settings: { enableDummyService: false }, services }).recover(checkpoint).resume();
execution.signal({ id: "execute" });
assert.equal(execution.state, "idle");
assert.equal(preparedCommands, 1);
console.log("BPMN runtime and serialized checkpoint recovery passed.");
