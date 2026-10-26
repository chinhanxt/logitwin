# Local development decision receipt

Authorization: user asked to continue building the white, bright Logistics platform for their DX-OS Open-Core competition and confirmed no existing FreshMesh repository/product name. Scope: reversible local implementation, tests, fixtures and local services.

Decision: allow creating `/home/chinhan/projects/dxos-logistics`, installing project dependencies, starting isolated loopback ports 5190–5193 and Keycloak container/volume `dxos-logistics-*`, calling existing local Ollama models, creating local validation artifacts. Do not publish, commit, push, contact others or change unrelated containers/projects.

Ownership: `/root` sole writer of project paths/manifests; read-only requirements/code reviewer `/root/requirements_review`. No second writer shares the checkout. Existing WareTrack remains an independent working prototype.

Policy/evidence: `/home/chinhan/AGENTS.md` and user supplied instructions. No project distributed collaboration harness or protected release capability identified. Registry lacks Ruflo guidance/memory tools; CLI memory lookup found no initialized project database. File receipts record development evidence; they do not claim a production promotion/release authority.

Safety envelope: loopback access; seeded sample tenants; no production logistics execution, orders or sensor changes. Private generated credentials and database under gitignored `var/`. Keycloak development only, Ollama local only. Existing model weights were reused, no cloud model calls or paid service actions.

Review findings fixed: stale approved proposal recovery; duplicate inbound; overlapping stock proposals; repeated markdown; receipt entity validation; RAG operation timeout/cancellation/concurrency; numeric-token claim limits and cited sources; gateway interrupted uploads; expired OIDC session cleanup.

Known limitations: see `competition/requirements.md` and `README.md`. Snapshot-bound test/build evidence: `validation-receipt.json`.

## Round 2 authorization update

User explicitly asked `/subagents` to split development, stay faithful to the same Drive brief and invest in 3D operational UI. Allow separate isolated writing checkouts under gitignored var/workspaces, root integration and local Three/BPMN dependencies. Team ownership and decisions recorded in `development-round-2.md`. Existing current DB preserved by consistent backup and isolated E2E database; no worktrees were deleted and no artifacts were published.

## WareTrack merge authorization update

User requested joining `/home/chinhan/projects/waretrack` with DX-OS and refining motion/3D presentation. Allow adapting existing geometry/camera into the portal, API-backed selection, read-only illustrative animation and local regression testing. Root owns main checkout; writing agents own separate `var/workspaces/waretrack-merge` copies. No shared manifest edits by agents, no WareTrack business tick, and no changes to original core business records. Tests use `var/e2e-waretrack-merge-reviewed.sqlite`; restore the normal `var/core.sqlite` runtime afterward. See `waretrack-integration-decision.json` and `waretrack-integration-validation.json`.
