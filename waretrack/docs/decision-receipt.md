# Local implementation decision

Authorization: user requested rebuilding `/home/chinhan/projects/waretrack` from `/home/chinhan/projects/file.md`, a larger map, less visible text, continued implementation, and fixing unnatural vehicle movement.

Decision: proceed with reversible local edits in this existing application. Root is the only writer; `/root/brief_audit` performed read-only review. Local development port: 5180. No commit, push, deployment, publication or new paid service is authorized or performed.

Scope: five procedural warehouse campuses, on-demand compact HUD, consistent entity selection, seeded fixed-step simulation, vehicle trajectories and frame interpolation, cargo transfer, charging and focused verification. User's later preference for fewer panels supersedes the brief's default all-panels-visible layout. Existing dependencies are reused.

Motion diagnosis: prior truck status changes and charger assignment jumped positions; heading did not follow paths; separately batched bodies could trail wheels by one render frame. Fix: shared continuous routes, bounded forklift steering/speed, physical charger arrival, shared fixed-step playback interpolation, dynamic vehicles rendered under one transform, carried cargo parented to forks. Separate cargo bays prevent repeated staging overlap.

Acceptance: TypeScript/build, simulation tests including 30 minutes of cycles, actual browser movement/pause sampling, selection and focus interactions, responsive visual inspection. Exact source/build hashes and observed results are recorded in `validation-receipt.json` after verification. The application is a demonstration with in-memory state and scripted paths, without production WMS connectivity or full collision avoidance.
