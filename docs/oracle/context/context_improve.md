# SmartFlow — Codex Implementation Context

## 1. Project identity

- **Project:** SmartFlow
- **Student/report owner:** Muhammad Danial
- **Student ID:** 3312401042
- **Study program:** Teknik Informatika
- **Institution:** Politeknik Negeri Batam
- **Team:** I Can Do IT
- **Event:** Batam Singapore Hackathon 2026
- **Theme:** Ease of Living & Sustainability
- **Subtopic:** Smart Mobility Flow – Tackling Traffic Congestion & Cross-Border Logistics
- **Duration:** 16-hour hackathon
- **Domain:** AI, Geo-AI, intelligent transportation, logistics information systems, and geospatial web applications.

## 2. Main implementation objective

Implement one complete end-to-end feature owned by Muhammad Danial:

> AI Logistic Oracle with persistent per-user chat history and a structured recommendation result modal.

The complete flow must cover:

1. An authenticated user opens `/oracle`.
2. The user creates or selects a conversation.
3. The user sends a natural-language logistics question.
4. The frontend sends the message to the backend.
5. The backend verifies the authenticated user.
6. The backend creates or retrieves a conversation owned by that user.
7. The backend invokes the AI agent.
8. The AI agent selects an allowed SmartFlow tool when needed.
9. The backend validates tool arguments.
10. The backend executes internal tools or connected services.
11. The backend sends tool output back to the AI model when required.
12. The backend produces a final answer with structured result metadata.
13. The backend persists the user message, assistant response, tool calls, and structured result.
14. The frontend displays the assistant response.
15. The frontend displays a structured result card or modal when structured data exists.
16. The user can refresh or return later and retrieve only their own history.

The implementation must not rely on a client-supplied arbitrary `user_id` for authorization. User identity must come from a validated Supabase session or JWT.

## 3. Contribution boundary

Muhammad Danial owns:

- Random Forest training workflow.
- Congestion prediction service.
- `GET /congestion`, subject to actual repository implementation.
- AI Logistic Oracle backend orchestration.
- Function-calling and tool validation.
- AI-agent guardrails and fallback behavior.
- Oracle frontend flow when required to complete the end-to-end feature.
- Persistent conversation history for authenticated users.
- Structured recommendation output and result modal.
- Tests and documentation for the above flow.

Other team members own:

- **Khairul Nizam:** route recommendation and interactive map.
- **Ananda Khusnul Hotimah:** departure recommendation logic and related UX.
- **Chelsea Maharani Putri:** ferry schedule data and schedule management.

Oracle may consume other team services through defined contracts but must not take over their internal business logic.

Do not claim that Muhammad Danial trained Gemini. Gemini or another LLM is an external model used for natural-language interaction and tool orchestration.

## 4. Required first actions

Before editing code:

1. Inspect the full repository tree.
2. Read the existing `README.md`.
3. Inspect the backend entry point, routers, authentication helpers, Supabase/database client, schema/migrations, agent configuration, and tests.
4. Inspect the frontend `/oracle` page, authentication provider, API utilities, components, and tests.
5. Check whether these already exist:
   - authentication middleware;
   - user identity extraction;
   - `POST /agent/chat`;
   - `/user/history`;
   - conversation tables;
   - message tables;
   - RLS policies;
   - structured agent responses;
   - result cards/modals.
6. Identify current implementation versus README claims.
7. Do not duplicate existing functionality.
8. Do not modify unrelated route, schedule, dashboard, or map features unless integration requires it.
9. Inspect existing schema and migration conventions before changing the database.
10. Inspect frontend callers and backend response models before changing API contracts.
11. Produce a short audit and implementation plan before broad code changes.

Do not expose, print, commit, or request secrets from `.env` files.

## 5. Expected technology stack

Verify every item against the repository before changing it:

- Frontend: Next.js, React, TypeScript, TailwindCSS, shadcn/ui, Leaflet.
- Backend: Python, FastAPI.
- Database/authentication: Supabase PostgreSQL and Supabase Auth.
- ML: scikit-learn Random Forest Classifier.
- Serialization: joblib.
- Routing: OSRM public API with Haversine fallback where applicable.
- AI agent: OpenAI-compatible function-calling provider configured by environment variables.
- Documented deployment: frontend Vercel and backend Railway. Verify actual deployment.

## 6. Documented repository structure

Treat this as a hypothesis and verify exact paths:

```text
hackathon/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── agent_config.py
│   ├── rf_model.joblib
│   ├── railway.json
│   ├── routers/
│   │   ├── agent.py
│   │   ├── congestion.py
│   │   ├── route.py
│   │   ├── schedules.py
│   │   └── user.py
│   ├── scripts/
│   │   └── prepare_data.py
│   └── database/
│       └── schema.sql
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── dashboard/page.tsx
│   │   │   │   ├── planner/page.tsx
│   │   │   │   ├── schedules/page.tsx
│   │   │   │   └── oracle/page.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── auth/callback/
│   │   ├── components/
│   │   │   ├── MapComponent.tsx
│   │   │   ├── MapView.tsx
│   │   │   ├── layout/Sidebar.tsx
│   │   │   ├── layout/Topbar.tsx
│   │   │   └── providers/AuthProvider.tsx
│   │   ├── utils/supabase/
│   │   └── proxy.ts
│   └── package.json
└── docs/
    ├── BUILDER_A.md
    └── methodology_notes.md
```

## 7. Existing documented API contracts

Verify all contracts against code before changing them.

### `GET /congestion`

Input:

```text
segment_id: string
 day_type: weekday | weekend
hour: integer 0–23
```

Expected response:

```json
{
  "source": "ml_model",
  "segment_id": "SEG001",
  "day_type": "weekday",
  "hour": 8,
  "congestion_level": "HIGH",
  "multiplier": 1.82
}
```

Expected fallback chain:

```text
ML inference → Supabase congestion_multipliers lookup → explicit default fallback
```

The response must identify the actual source, such as:

- `ml_model`
- `database_fallback`
- `default_fallback`

Do not label synthetic or estimated data as real-time traffic data.

### `POST /route`

This endpoint belongs to the route feature owner. Oracle may consume it if available.

Documented request:

```json
{
  "origin": {"lat": 1.1291, "lng": 104.0494},
  "destination": {"lat": 1.1633, "lng": 104.0044},
  "time": "08:00",
  "day_type": "weekday"
}
```

Documented response:

```json
{
  "distance_km": 5.23,
  "base_time_min": 7.84,
  "final_time_min": 14.26,
  "congestion_level": "HIGH",
  "congestion_multiplier": 1.82,
  "emission_kg": 1.9,
  "routing_source": "OSRM API",
  "matched_segment_id": "SEG001",
  "route_geometry": {"type": "LineString", "coordinates": []}
}
```

Do not modify route logic unless necessary for a clearly defined integration contract.

### `GET /schedules`

This endpoint belongs to the ferry schedule feature. Oracle may consume it through:

```text
get_ferry_schedule(terminal, destination?)
```

Minimum normalized tool output:

```json
{
  "terminal": "Batam Center",
  "destination": "HarbourFront Singapore",
  "departure_time": "08:20",
  "cutoff_time": "07:50",
  "vessel_type": "Fast Ferry",
  "capacity": 0.5,
  "data_status": "database"
}
```

The actual schema may use multiple rows or departure-time arrays. Inspect the repository and normalize only at the tool boundary if needed.

### Existing `POST /agent/chat`

Documented request:

```json
{
  "message": "What is the congestion at Yos Sudarso right now?"
}
```

Documented response:

```json
{
  "reply": "Based on current data, Yos Sudarso is experiencing HIGH congestion..."
}
```

Target response may extend the existing contract while preserving compatibility:

```json
{
  "conversation_id": "uuid",
  "message_id": "uuid",
  "reply": "...",
  "tool_calls": [],
  "result": {
    "type": "congestion",
    "title": "Congestion result",
    "data": {},
    "data_status": "synthetic_estimate",
    "source": "ml_model",
    "disclaimer": "This result is based on SmartFlow project data and is not real-time traffic data."
  }
}
```

Do not break existing consumers without updating and testing them.

## 8. AI-agent tools

Current documented tools:

```text
get_congestion_level(segment_id, day_type, hour)
get_ferry_schedule(terminal, destination?)
get_optimal_route(origin, destination, time, day_type)
```

Optional tool:

```text
get_departure_recommendation(...)
```

Register the optional departure tool only if its endpoint exists and is tested.

### Tool rules

1. Tool names must be explicit and stable.
2. Validate tool arguments with backend schemas.
3. Never execute arbitrary functions selected by the model.
4. Validate model-generated IDs and values.
5. Never expose secrets to the model.
6. Include source and data status in tool results.
7. Never claim real-time information unless the source is genuinely real-time.
8. Return controlled error objects when tools fail.
9. Never invent missing tool values.
10. Ask for clarification when required information is missing.

### Domain guardrails

Limit the agent to SmartFlow logistics topics:

- congestion;
- routes;
- ferry schedules;
- departure planning;
- estimated travel time;
- estimated fuel or emissions;
- SmartFlow usage.

For unrelated requests, politely state that the agent is limited to SmartFlow logistics assistance.

## 9. Persistent history requirements

Implement persistent chat history with user ownership.

Conceptual relationship:

```text
auth.users
  └── conversations
        └── chat_messages
```

Recommended schema:

```text
conversations
- id UUID primary key
- user_id UUID not null references auth.users(id)
- title TEXT nullable
- created_at TIMESTAMPTZ not null
- updated_at TIMESTAMPTZ not null
- archived_at TIMESTAMPTZ nullable
```

```text
chat_messages
- id UUID primary key
- conversation_id UUID not null references conversations(id)
- user_id UUID not null references auth.users(id)
- role TEXT check: user | assistant | tool | system
- content TEXT nullable
- tool_name TEXT nullable
- tool_arguments JSONB nullable
- tool_result JSONB nullable
- structured_result JSONB nullable
- data_status TEXT nullable
- created_at TIMESTAMPTZ not null
```

If the repository already has equivalent tables, adapt them instead of creating duplicates.

### Ownership rules

- Every conversation has a `user_id`.
- Every message belongs to a conversation.
- Backend derives user identity from a verified JWT/session.
- Client cannot choose another user identity.
- Conversation listing/retrieval filters by authenticated user.
- Message retrieval occurs only through an owned conversation.
- Update/delete operations enforce ownership.
- Use Supabase Row Level Security when direct client access exists.
- If database access is backend-only, enforce ownership in backend queries and preferably retain RLS as defense in depth.

### Required security tests

1. Authenticated user can create a conversation.
2. Authenticated user can send a message to their conversation.
3. User can list only their conversations.
4. User can retrieve only their messages.
5. User A cannot retrieve User B’s conversation by ID.
6. User A cannot append a message to User B’s conversation.
7. Unauthenticated requests are rejected.
8. Invalid conversation IDs are handled safely.
9. Client-supplied `user_id` is ignored or rejected.

## 10. Frontend requirements

The `/oracle` page should support:

- conversation list/sidebar;
- new conversation action;
- active conversation display;
- user and assistant message bubbles;
- loading/typing state;
- error state;
- retry action where appropriate;
- quick-action suggestions;
- structured result preview;
- modal for full recommendation details;
- source/status labels;
- synthetic/estimated-data disclaimer;
- empty state;
- refresh persistence;
- selecting an old conversation;
- safe rendering of untrusted text and JSON.

### Suggested structured result type

```typescript
type OracleResult = {
  type: "congestion" | "schedule" | "route" | "departure" | "generic";
  title: string;
  data: Record<string, unknown>;
  source?: string;
  data_status?: string;
  disclaimer?: string;
};
```

The modal must be driven by structured backend data, not by parsing arbitrary prose whenever possible.

The modal should distinguish clearly between:

- result value;
- source;
- estimated/synthetic status;
- limitations;
- timestamp when available.

Do not show the recommendation modal when no validated structured result exists.

## 11. Random Forest model context

Training notebook: `train_model.ipynb`

Known behavior:

- Fetches `road_segments` from Supabase.
- Fetches `congestion_multipliers` from Supabase.
- Uses six road segments.
- Uses 25 congestion multiplier records.
- Expands time windows into hourly synthetic rows.
- Handles windows crossing midnight.
- Handles full-day weekend windows.
- Produces approximately 14,400 synthetic rows.
- Target classes: `low`, `medium`, `high`.
- `is_peak` is derived from hour independently of target.
- Target label comes from source `congestion_level`.
- Documented one-hot features:
  - `hour`
  - `is_peak`
  - `day_type_weekday`
  - `day_type_weekend`
  - `corridor_type_access_road`
  - `corridor_type_industrial_arterial`
  - `corridor_type_urban_arterial`
- Model: `RandomForestClassifier`.
- Model artifact: `rf_model.joblib`.
- README reports 50 estimators and 95.1% overall accuracy. Verify actual notebook execution and evaluation code before treating it as final.
- Report performance only as performance on the project dataset.
- Never describe it as real-world traffic accuracy.

### Methodology audit requirement

Synthetic rows are repeatedly generated from the same time windows and source labels. A random row-level split may produce optimistic evaluation because highly similar generated rows can appear in both train and test sets.

Do not silently change the methodology. If evaluation is improved with grouped/source-window splitting, document the change and compare results transparently.

## 12. Database source context

Expected tables:

### `road_segments`

Six segments:

- SEG001: Jl. Yos Sudarso
- SEG002: Jl. Jenderal Sudirman
- SEG003: Jl. Ahmad Yani
- SEG004: Jl. Brigjen Katamso
- SEG005: Jl. Trans Barelang
- SEG006: Jl. Hang Jebat

### `congestion_multipliers`

Contains:

- segment ID;
- day type;
- time window;
- hour start;
- hour end;
- multiplier;
- congestion level;
- description.

### `ferry_schedules`

Contains:

- terminal;
- destination;
- departure time or departure-time array;
- cutoff time;
- vessel type;
- cargo capacity.

### `route_query_log`

Documented historical route query store:

```text
route_query_log
- id
- created_at
- origin
- destination
- result_json
```

Do not use `route_query_log` as a replacement for per-user chat history unless the actual project design explicitly requires it.

## 13. Academic and data-validity rules

- Synthetic data is not real-time traffic data.
- Estimated values are not direct measurements.
- Database availability is not equivalent to data freshness.
- AI-generated text is not evidence of a tool result.
- Route recommendation is not automatically mathematical optimization.
- Estimated emissions are not proof of emission reduction.
- Model accuracy on synthetic data is not real-world traffic accuracy.
- Do not invent missing schedules, routes, emission values, or congestion values.
- Add transparent fallback, source, and data-status metadata.
- Never put API keys or private credentials in source code or documentation.
- Do not add unverified references or fabricated metrics.

## 14. Implementation phases

### Phase 1 — Repository audit

- Inspect files.
- Run existing tests.
- Start backend/frontend if possible.
- Confirm authentication behavior.
- Confirm `/agent/chat`.
- Confirm `/user/history`.
- Inspect database schema and RLS.
- Document README/code discrepancies.

### Phase 2 — Database foundation

- Add or adapt conversations table.
- Add or adapt chat messages table.
- Add ownership and timestamps.
- Add indexes for user and conversation lookup.
- Add RLS policies where appropriate.
- Add migration/schema documentation.
- Do not apply destructive migrations automatically.

### Phase 3 — Backend history API

Possible endpoints, only if compatible with project conventions:

```text
GET    /user/conversations
POST   /user/conversations
GET    /user/conversations/{conversation_id}
PATCH  /user/conversations/{conversation_id}
DELETE /user/conversations/{conversation_id}
GET    /user/conversations/{conversation_id}/messages
```

Retain and extend `/user/history` instead if that is the existing convention.

### Phase 4 — Agent integration

- Add optional `conversation_id` to chat request.
- Resolve/create conversation under authenticated user.
- Persist user message.
- Run agent and tools.
- Persist tool messages/results.
- Persist assistant response and structured result.
- Return conversation and message IDs.
- Return source, data status, and disclaimer.

### Phase 5 — Frontend history

- Load current user conversations.
- Create a new conversation.
- Select an existing conversation.
- Load messages.
- Send message with conversation ID.
- Update title if appropriate.
- Handle loading, errors, and retry.

### Phase 6 — Structured result modal

- Define typed response contract.
- Add result preview.
- Add modal component.
- Render validated result types only.
- Add source/status/disclaimer.
- Add fallback and empty states.

### Phase 7 — Testing

Backend:

- authentication;
- ownership;
- API schemas;
- tool validation;
- fallback behavior;
- agent response;
- persistence.

Frontend:

- history loading;
- conversation switching;
- sending messages;
- modal rendering;
- error states;
- refresh persistence.

Integration:

- User A/User B isolation;
- message persistence;
- tool-result persistence;
- AI-provider failure;
- Supabase failure;
- invalid tool arguments;
- missing user input.

### Phase 8 — Documentation

Update where appropriate:

- README;
- API documentation;
- schema/migration documentation;
- environment example;
- test instructions;
- implementation notes;
- evidence checklist for the final academic report.

## 15. Acceptance criteria

### Authentication and ownership

- Logged-in user can access Oracle.
- Unauthenticated user cannot use protected history endpoints.
- User identity comes from verified authentication.
- User A cannot read, modify, or append to User B’s conversation.

### Conversation history

- New conversation can be created.
- Messages persist in the database.
- Conversations survive refresh and later login.
- Conversation list is scoped to the current user.
- Messages are ordered deterministically.
- Errors do not create misleading assistant messages.

### AI agent

- Agent uses only registered tools.
- Tool arguments are validated.
- Tool outputs are persisted or represented in persisted metadata.
- Response identifies source/status where relevant.
- Missing input causes clarification.
- Out-of-domain questions use guardrails.
- Provider failure produces a transparent fallback.

### Structured result modal

- Modal opens only for validated structured results.
- Modal shows result, source/status, and limitations.
- Modal does not invent absent fields.
- Synthetic/estimated values are labeled.
- Empty and error states are handled.

### ML service

- Valid `/congestion` requests return the expected schema.
- Invalid segment/day/hour values are rejected clearly.
- Fallback source is distinguishable from ML source.
- Model artifact and preprocessing columns remain compatible.

## 16. Evidence to collect for the report

Save evidence for BAB III and BAB IV:

- database schema/migration;
- RLS policies;
- API request/response examples;
- screenshot of a new conversation;
- screenshot of persisted history after refresh;
- screenshot of a selected old conversation;
- screenshot of the structured result modal;
- screenshot showing source/data-status disclaimer;
- test showing User A cannot access User B’s history;
- tool-call logs with secrets removed;
- ML training configuration;
- dataset row counts;
- class distribution;
- feature list;
- train/test strategy;
- accuracy, precision, recall, F1-score;
- confusion matrix;
- feature importance when available;
- API response-time measurements;
- failure/fallback test outputs;
- Git commits or pull requests showing ownership.

Do not put fabricated results into the report. BAB IV may contain only actual implementation and test results.

## 17. Coding rules for the agent

- Inspect before editing.
- Make small, reviewable changes.
- Preserve existing behavior unless explicitly required.
- Use typed request/response schemas.
- Keep secrets out of code and logs.
- Avoid logging full JWTs, API keys, or private user content unnecessarily.
- Validate all external and model-generated inputs.
- Use parameterized/database SDK queries.
- Enforce ownership on every read and write.
- Add tests for security boundaries.
- Do not silently swallow exceptions.
- Return controlled, user-safe errors.
- Do not use arbitrary JSON parsing as the primary authorization mechanism.
- Do not claim a feature is implemented until tested.
- After each phase, report files changed, migrations required, commands run, tests passed/failed, and remaining risks.

## 18. Desired first Codex response

Before changing code, respond with:

1. Repository tree summary.
2. Current authentication flow.
3. Current Oracle implementation.
4. Current database schema and RLS status.
5. Existing history-related endpoints/tables.
6. Exact gaps against acceptance criteria.
7. Proposed file-by-file implementation plan.
8. Required migration or environment changes.
9. Tests that will be added.
10. Confirmation that no destructive change will be made without approval.

Only after this audit should implementation begin.

## 19. Academic report structure

The implementation must generate evidence for the following structure.

### BAB III — Analisis dan Perancangan

- **3.1 Pengumpulan Data**
- **3.2 Preprocessing Data**
- **3.3 Penerapan Metode AI**
- **3.4 Integrasi ke Aplikasi**
- **3.5 Evaluasi Hasil**

Each subsection must distinguish theory, project activity, input, process, output, tools, parameters, technical decisions, and supporting diagrams/tables.

### BAB IV — Hasil dan Pembahasan

- **4.1 Pengumpulan Data**
- **4.2 Preprocessing Data**
- **4.3 Pengolahan Data**
- **4.4 Integrasi ke Aplikasi**
- **4.5 Hasil Evaluasi**

BAB IV must contain actual results only. Do not write target metrics or planned features as completed results.

## 20. Report validity warnings

- Do not describe Random Forest accuracy as actual Batam traffic accuracy.
- Do not call database results real-time without a real-time source.
- Do not claim SmartFlow reduces emissions without a comparative experiment.
- Do not claim Gemini was trained by Muhammad Danial.
- Do not claim OSRM/Gemini integration without implementation evidence.
- Do not call a score-based route recommendation mathematical optimization unless it actually is.
- Do not fabricate references, metadata, metrics, usability results, or screenshots.

## 21. Source project files

The context was compiled from:

- `context_pack_smartflow.md`
- `README.md`
- `Laporan TA SmartFlow.docx`
- `rencana_fitur_smartflow_revisi_ai_agent.docx`
- `Batam SmartFlow Data Master (2).xlsx`
- `train_model.ipynb`

## 22. Initial Codex command

Use this command after loading the context:

```text
Mulai dengan audit repository sesuai bagian “Required first actions” dan “Desired first Codex response”. Jangan mengubah kode atau database terlebih dahulu. Periksa autentikasi, struktur database, RLS, endpoint /agent/chat, endpoint /user/history, halaman /oracle, dan konfigurasi agent. Bandingkan kondisi aktual dengan acceptance criteria. Setelah itu tampilkan rencana file-per-file, migration yang diperlukan, risiko, dan daftar test yang akan dibuat. Jangan mencetak atau meminta secret dari file .env.
```
