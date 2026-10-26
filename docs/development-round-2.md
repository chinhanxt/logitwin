# Đợt phát triển 2 — theo yêu cầu chia subagents

User explicitly requested subagents and strict alignment with the supplied DX-OS brief, with investment in the 3D operational UI. Work remained local and reversible; no publication or commits.

## Ownership and evidence

| Agent | Scope | Writing checkout |
|---|---|---|
| `/root/brief_research` | Verify brief + primary BPMN docs + acceptance | Read-only |
| `/root/lifecycle` | FEFO lots, source/transit/target, purchase receipt/cancel + tests | `var/workspaces/round-2/lifecycle` |
| `/root/ui3d` | Procedural operational scene, interaction, inspector + derivation tests | `var/workspaces/round-2/ui3d` |
| `/root` | Integration, manifests, BPMN, SSE, API/portal wiring, validation and receipts | Main project |

Separate writing checkouts were created from the existing source. Shared node_modules was read-only for agents; root alone changed package/lockfiles. Isolated preview port 5194 was released after UI visual checks. No two writers used the same checkout. Ruflo hierarchical ledger `swarm-1791966888192-imis5o`; execution performed by Codex agents.

Source PDF live re-download matched SHA256 `ed57bb280ae3cad2ae7f1ff9b4c00ab3c8d0b6d4138d8e19f90ab5ef5fe24393`. Requirements and technology choices are documented in `competition/requirements.md`.

## Decisions

- Allow bounded local dependencies and code integration; no new vendor fleet, model download or paid services needed.
- Use genuine bpmn-engine 26.0.5 with fixed versioned definitions and user tasks for approval/execution/dispatch/receipt. No XML or script upload endpoint.
- Prepare BPMN next command/checkpoint without business side effects; domain writes, checkpoint and audit commit atomically with nested synchronous SAVEPOINTs. Exactly-one command staging checked; failed preconditions retain stored wait.
- Add tenant-scoped persisted-event SSE replay, per-identity connection limits, session expiry/logout closure and backpressure. This is not a distributed broker/lakehouse.
- Retain old aggregate data, migrate to explicitly named legacy lots; don't invent missing historical source batches. Consistent pre-change DB backup in `var/backups/pre-round-2.sqlite`; agent rehearsed migration against a read-only online backup before integration.
- Transfer dispatch reduces physical source into in-transit; receipt adds destination with allocated source-lot provenance. Cancellation only before dispatch. PO full receipt requires new batch/expiry/full quantity; supplier evidence remains unconnected.
- Operational 3D takes API data, uses authentic object/decision/event IDs, exposes permission/state-dependent commands and BPMN evidence, supports keyboard/camera/focus/fullscreen/mobile/WebGL fallback. Scene geography/vehicles/boxes are illustrative; no fake GPS/autonomous completion.

## Validation

See `validation-receipt.json`, `twin-api-validation.json`, `ai-validation.json` and screenshots. Automated scenario uses a separate `var/e2e-round-2.sqlite` so current user/demo core database can be preserved. The primary runtime is returned to `var/core.sqlite` after testing. Domain tests use isolated databases.

Legacy/read-only review found and resolved nondeterministic cancellation test setup, an unused BPMN command-stage guard, hold-stock UI availability, in-transit cancel UI affordance and mixed-unit totals. Review did not claim full certification or complete seven-layer implementation.

## Remaining scope

OCR, FL, PACO, object/file malware quarantine, NGSI-LD/sensors, Lakehouse, distributed streaming, immutable ledger, GitOps and complete restore drills remain tracked as unimplemented. Per-lot sales/disposal/recall/returns and partial receipts are also absent. The new workflow uses versioned fixed definitions; definition upgrade/migration needs an explicit future path.
