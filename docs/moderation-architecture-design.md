# Discord Moderation Platform Architecture Design (Phase 1)

## 1. Architecture explanation

### A) High-level architecture diagram description

```text
Discord Gateway Events (messageCreate, messageUpdate, memberUpdate, interactionCreate)
        |
        v
Ingress Layer (Shard Worker)
- lightweight validation
- attach event metadata (guildId, shardId, receivedAt)
- publish normalized event
        |
        +--> Redis Stream / Kafka Topic: moderation.events
                    |
                    v
Moderation Orchestrator Consumers (horizontally scaled stateless workers)
- idempotency guard
- fetch cached guild automod policy
- invoke rule engine
                    |
                    +--> Automated Moderation Engine
                    |       - content analysis pipeline
                    |       - sliding window spam detector
                    |       - policy + escalation resolver
                    |
                    +--> Reputation Engine
                    |       - score update scheduler
                    |       - decay + reward jobs
                    |
                    +--> Case Logging Service
                            - case write model
                            - context snapshot builder
                            - outbox for audit logs

Shared Dependencies:
- Redis Cluster: hot config cache, rate limits, distributed locks, sliding counters
- Primary DB (Postgres/MySQL): durable cases, infractions, reputation state
- Queue (BullMQ/SQS): async punishment tasks and retry workflows
- Object Storage (optional): large context attachments (message snapshots)

Outbound Integrations:
- Discord REST actions (delete message, timeout, ban)
- Logging sink (channel/webhook/observability stack)
```

### B) Data flow between message events, automod engine, case system, and reputation engine

1. **Event ingress**: shard receives `messageCreate` and normalizes into an immutable event envelope with `eventId`, `guildId`, `userId`, `messageId`, `contentHash`, and timestamps.
2. **Publish-first pattern**: shard pushes envelope to a queue/stream immediately (no heavy logic on gateway thread).
3. **Orchestration consumer** loads automod config from Redis (fallback DB on cache miss), then executes ordered checks:
   - fast checks: rate limit, duplicate content, mention flood
   - medium checks: regex/profanity/link policies
   - expensive checks: optional ML or external classifier
4. **Decision object** is created (`ALLOW`, `FLAG`, `DELETE`, `TIMEOUT`, `BAN`) with confidence, matched rules, and escalation level.
5. **Punishment command** emitted to `moderation.actions` queue with an idempotency key.
6. **Case Logging Service** consumes final action result (attempted + executed), creates/updates case record with context payload and linked infraction row.
7. **Reputation Engine** consumes same domain event and applies penalty/reward deltas, then schedules decay recalculation.
8. **Audit/log projection** sends formatted mod-log message and metrics events.

This event-driven fan-out guarantees loose coupling while keeping case and reputation eventually consistent.

### C) Clear module boundaries

1. **Gateway Ingress Module**
   - responsibility: normalize Discord events, no business policy
   - forbidden: direct DB writes except emergency telemetry
2. **Automod Rule Engine**
   - responsibility: evaluate content against policies, output deterministic decision
   - forbidden: calling Discord API directly
3. **Enforcement Executor**
   - responsibility: execute Discord actions with retry/backoff, produce action-result events
   - forbidden: mutate reputation directly
4. **Case Write Service**
   - responsibility: persist case + context + infraction atomically
   - forbidden: policy evaluation
5. **Reputation Service**
   - responsibility: score updates, decay, reward jobs
   - forbidden: direct moderation action execution
6. **Config Service**
   - responsibility: read/write guild configs, cache invalidation
7. **Command API Layer (`/automod`, `/case`, `/rep`)**
   - responsibility: admin/operator interaction, permission checks, command audit events

### D) Event-driven integration strategy

### E) Command UX design (`/automod`, `/case`, `/rep`)

**`/automod`** (Manage Server + dedicated Automod Manager role)
- `config view`
- `config set <rule> <value>`
- `rule enable <rule_id>`
- `rule disable <rule_id>`
- `exempt add-role <role>` / `exempt remove-role <role>`
- `simulate message <content>` (dry-run against current rules)
- `thresholds view|set`

**`/case`** (Moderator+)
- `view <case_id>`
- `list [user] [action] [status] [limit]`
- `note add <case_id> <text>`
- `status set <case_id> <status>`
- `link message <case_id> <message_id>`
- `export [user] [time_range]`

**`/rep`**
- user-facing:
  - `me`
  - `history [limit]`
- moderator/admin:
  - `view <user>`
  - `adjust <user> <delta> <reason>` (Admin only)
  - `tier-config view|set` (Admin only)
  - `recalc <user>` (Admin only)

**Permission model**
- Layer 1: Discord permissions (`ManageGuild`, `ModerateMembers`, `BanMembers`).
- Layer 2: Bot role-based ACL overrides (`automod_manager`, `senior_mod`, `rep_admin`).
- Layer 3: command-level policy matrix in DB (guild-customizable).
- All privileged commands write immutable audit entries.


Use domain events with versioned contracts:

- `ModerationEventReceived.v1`
- `ModerationDecisionMade.v1`
- `ModerationActionExecuted.v1`
- `CaseRecorded.v1`
- `ReputationUpdated.v1`

Practices:
- **Outbox pattern** on DB-bound services to guarantee “write + publish” consistency.
- **At-least-once delivery** with consumer idempotency keys.
- **Schema versioning** to evolve payloads safely.
- **Dead-letter queues** for poison messages.
- **Per-guild partition key** to preserve ordering for the same guild/member while allowing global parallelism.

---

## 2. Data models

### AutomodConfig (per guild)

**Table: `automod_configs`**
- `guild_id` (PK, bigint/string)
- `enabled` (bool)
- `version` (int, optimistic concurrency)
- `rules_json` (jsonb) — normalized rule definitions
- `escalation_policy_json` (jsonb)
- `exempt_roles_json` (jsonb)
- `exempt_channels_json` (jsonb)
- `updated_by` (user id)
- `updated_at` (timestamp)

**Indexes**
- PK on `guild_id`
- optional `updated_at` index for cache warmers

### Case records with context payload

**Table: `cases`**
- `case_id` (PK, sortable snowflake/uuid)
- `guild_id` (indexed)
- `target_user_id` (indexed)
- `actor_user_id` (mod id or `SYSTEM`)
- `action_type` (enum: WARN/TIMEOUT/BAN/...)
- `status` (enum: ATTEMPTED/SUCCEEDED/FAILED/REVERTED)
- `reason` (text)
- `context_ref` (FK to context blob table/object storage pointer)
- `created_at` (timestamp)

**Table: `case_context`**
- `context_id` (PK)
- `guild_id`
- `message_id` (nullable)
- `channel_id` (nullable)
- `snapshot_json` (jsonb: content excerpt, matched rules, message metadata)
- `created_at`

**Indexes**
- `cases(guild_id, created_at DESC)` for mod history views
- `cases(guild_id, target_user_id, created_at DESC)` for per-user lookup
- `cases(guild_id, action_type, created_at DESC)` for analytics

### Reputation records per user

**Table: `reputation`**
- `guild_id`
- `user_id`
- `score` (int or decimal)
- `trust_tier` (enum)
- `last_event_at` (timestamp)
- `last_decay_at` (timestamp)
- `positive_streak_days` (int)
- `updated_at`
- PK `(guild_id, user_id)`

**Table: `reputation_events`**
- `event_id` (PK)
- `guild_id` (indexed)
- `user_id` (indexed)
- `source_type` (enum: INFRACTION, CLEAN_REWARD, MANUAL)
- `delta` (int)
- `metadata_json` (jsonb)
- `created_at`
- unique `(guild_id, user_id, source_type, metadata_hash)` when applicable for idempotency

**Indexes**
- `reputation(guild_id, score)` for leaderboard/tier scans
- `reputation_events(guild_id, user_id, created_at DESC)`

### Infraction history

**Table: `infractions`**
- `infraction_id` (PK)
- `guild_id` (indexed)
- `user_id` (indexed)
- `case_id` (FK unique)
- `type` (enum)
- `severity` (smallint)
- `rule_id` (string)
- `active` (bool)
- `expires_at` (nullable)
- `created_at`

**Indexes**
- `infractions(guild_id, user_id, created_at DESC)`
- partial/filtered index on active infractions: `(guild_id, user_id) WHERE active=true`
- `infractions(guild_id, type, created_at DESC)`

### Sliding window tracking strategy

Use Redis sorted sets/counters to avoid high write volume to SQL:

- key: `sw:{guildId}:{userId}:{windowType}`
- member: `eventId`
- score: event timestamp millis

Operations:
- `ZADD` current event
- `ZREMRANGEBYSCORE` old entries outside window
- `ZCARD` for current window count
- set short TTL to auto-clean

For distributed exact-once-like behavior, combine with Lua script to make these operations atomic.

---

## 3. Algorithms

### Spam detection algorithm (sliding window)

Hybrid detector per user+channel and user+guild:
1. Maintain N windows (e.g., 5s, 30s, 5m) counters in Redis.
2. Track features per event:
   - message rate
   - duplicate hash ratio
   - mention count rate
   - link count rate
3. Score = weighted sum of normalized features.
4. Trigger thresholds by trust tier (lower trust => stricter).

Complexity per message:
- Time: **O(log n)** per ZSET operation, constant number of windows/features
- Space: **O(k)** events retained within active windows

### Escalation threshold calculation

Use cumulative severity index over recent infractions:

`escalation_index = Σ(severity_i * decay(age_i)) + current_violation_weight`

where `decay(age)=exp(-lambda * age_days)`.

Map index bands to action ladder:
- 0-2 warn
- 2-5 timeout short
- 5-8 timeout long
- 8+ ban/quarantine review

Complexity:
- If pre-aggregated rolling score in Redis: **O(1)** read/update
- If computed from DB history each time: **O(m)** (m recent infractions)

### Reputation decay model

Continuous decay toward neutral baseline:

`score_t = baseline + (score_prev - baseline) * exp(-k * delta_days)`

Apply lazily on read/write (no full-table cron scan required):
- calculate decay only when user has activity or admin queries score.

Complexity:
- **O(1)** per touched user

### Clean behavior reward system

Rules:
- reward only after minimum activity + no infractions in rolling period
- capped positive delta per day/week
- anti-farming: ignore low-signal messages (very short duplicates, bot-like patterns)

Example:
- +1 daily if at least 10 meaningful messages and no violations in 24h
- bonus streak multiplier capped at 7-day equivalent

Complexity:
- **O(1)** with cached counters

### Rate limiting approach

Multi-layer token bucket:
1. Global per-guild moderation action budget
2. Per-user enforcement budget
3. Per-command invoker budget for slash commands

Implement in Redis with atomic Lua script (`refill + consume + result`).

Complexity:
- **O(1)** per check

---

## 4. Scalability strategy

### In-memory cache vs Redis

- **In-memory (per process)**: fastest for hot local reads but shard-local only; can cause config drift across workers.
- **Redis**: shared truth for hot mutable data (automod configs, idempotency keys, sliding windows, rate limits).
- Recommended: two-tier cache
  - L1: in-process LRU with short TTL (e.g., 10-30s)
  - L2: Redis with pub/sub invalidation on config changes

### Horizontal scaling impact

- Stateless workers subscribe to queues; scale by increasing consumers.
- Partition stream by `guildId` to minimize ordering anomalies.
- Keep DB writes batched where possible (e.g., reputation event compaction).

### Prevent cross-shard duplication

- Deterministic idempotency key: `guildId:userId:messageId:ruleId:actionType`.
- Store key in Redis `SETNX` with expiry before executing punishment.
- Only worker acquiring key proceeds; others skip.
- For strong guarantees on case creation, enforce DB unique constraint on same key.

### Queue-based moderation handling

Pipeline queues:
1. `moderation.events` (ingress)
2. `moderation.actions` (enforcement)
3. `moderation.persistence` (case + infraction)
4. `moderation.reputation` (score updates)

Each queue has:
- retry policy with exponential backoff + jitter
- dead-letter queue
- observability metrics (lag, retries, failures)

---

## 5. Final implementation plan in ordered tasks

1. **Define event contracts** and shared TypeScript types (versioned schemas).
2. **Introduce Redis-backed primitives**: idempotency store, sliding windows, rate limiter.
3. **Build Automod Rule Engine** as pure functions + policy resolver.
4. **Implement Moderation Orchestrator** consumer and decision pipeline.
5. **Implement Enforcement Executor** with Discord REST retries and action-result events.
6. **Create case/infraction write service** with transactional writes + outbox.
7. **Create reputation service** (delta application, lazy decay, reward scheduler).
8. **Add slash command groups** (`/automod`, `/case`, `/rep`) backed by query/services only.
9. **Add cache invalidation + config versioning** for automod updates.
10. **Add observability**: metrics, structured logs, trace IDs across events.
11. **Add failure drills**: DB outage simulation, Discord API failures, duplicate event replay.
12. **Load test at scale profile** (100k+ members equivalent event burst), tune partitions and thresholds.

## Failure handling specifics (cross-cutting)

- **If DB fails**: queue persistence task for retry, mark action as `PERSIST_PENDING`, emit alert, never block ingestion thread.
- **If message deletion fails**: continue escalation path with fallback (timeout/warn), case status includes partial failure details.
- **Duplicate punishments**: prevented by idempotency keys + DB uniqueness + action state machine (`PENDING -> EXECUTED/FAILED`).
- **Idempotency strategy**: every event and action carries immutable ids; consumers store processed ids with TTL and dedupe before side effects.
