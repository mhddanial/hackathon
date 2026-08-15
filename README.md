# 🚢 SmartFlow — Batam Cross-Border Logistics Intelligence Platform

> **Hackathon Project** · Built in 16 hours · Full-stack AI-powered logistics optimization for the Singapore–Batam maritime corridor

[![Backend](https://img.shields.io/badge/Backend-FastAPI%200.138-009688?logo=fastapi)](https://smartflow-api.up.railway.app)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js%2016.3-black?logo=next.js)](https://frontend-nine-blue-dx6g6mxt1e.vercel.app)
[![ML Model](https://img.shields.io/badge/ML-Random%20Forest%2095.1%25%20Accuracy-blue?logo=scikit-learn)](https://scikit-learn.org)
[![Database](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ecf8e?logo=supabase)](https://supabase.com)

---

## 📌 Table of Contents

1. [Problem Statement](#-problem-statement)
2. [Solution Overview](#-solution-overview)
3. [User Stories](#-user-stories)
4. [System Architecture](#-system-architecture)
5. [Features](#-features)
6. [Technology Stack](#-technology-stack)
7. [API Documentation](#-api-documentation)
8. [Database Schema](#-database-schema)
9. [Machine Learning Model](#-machine-learning-model)
10. [Deployment](#-deployment)
11. [Local Development Setup](#-local-development-setup)
12. [Environment Variables](#-environment-variables)
13. [Project Structure](#-project-structure)

---

## 🎯 Problem Statement

The **Singapore–Batam maritime corridor** is one of Southeast Asia's busiest short-sea freight routes. Logistics operators face three compounding challenges:

1. **Unpredictable Port Congestion** — Batu Ampar Port and land corridors experience erratic traffic surges, especially during peak hours (06:00–09:00 and 16:00–19:00), leading to missed ferry cut-off times and idle cargo.

2. **Fragmented Information** — Ferry schedules, port congestion levels, and optimal departure windows exist in separate, disconnected systems. There is no single platform that surfaces all of this in real time to the field operator.

3. **Carbon Blind Spots** — Route selection decisions are made with zero visibility into their emission impact, making it impossible to optimize for sustainability alongside cost and speed.

---

## 💡 Solution Overview

SmartFlow is a **full-stack, AI-powered logistics intelligence platform** that aggregates congestion prediction, route optimization, and ferry schedule data into a single operator dashboard.

### How It Works

```
Operator Query → AI Agent (Gemini) → Tool Calls → ML Model + Supabase + OSRM API
                                                        ↓
                              Real-time answer: departure time, route, congestion, emission score
```

| Core Capability | Implementation |
|---|---|
| **Port Congestion Prediction** | Random Forest model (95.1% accuracy); fallback to Supabase DB lookup |
| **Route Optimization** | OSRM routing engine + ML congestion multiplier; Haversine fallback |
| **Ferry Schedule Access** | Live query to Supabase `ferry_schedules` table (20 schedules) |
| **AI Assistant** | Google Gemini 2.5 Flash with function-calling tools wired to real APIs |
| **Emission Scoring** | `distance_km × 0.2 kg/km × congestion_multiplier` per route query |

---

## 👤 User Stories

### As a Logistics Coordinator (Primary User)

| # | Story | Acceptance Criteria |
|---|---|---|
| US-01 | See current congestion level at Yos Sudarso corridor at a glance | Dashboard shows live congestion level (LOW/MEDIUM/HIGH) from ML API |
| US-02 | View all upcoming ferry departures for today | Schedules page shows full table from Supabase (times, vessel, capacity) |
| US-03 | Input origin/destination and receive optimal route with emission score | Planner returns OSRM route on Leaflet map with distance, duration, CO₂ |
| US-04 | Ask natural language questions and get intelligent answers | Oracle chat → Gemini → real congestion and schedule data |
| US-05 | Log in securely with protected dashboard | Supabase Auth (email + Google OAuth); Next.js proxy middleware |

### As a Port Operations Manager (Secondary User)

| # | Story | Acceptance Criteria |
|---|---|---|
| US-06 | See Batu Ampar Port capacity utilization | Dashboard congestion % bar for primary port segment (SEG001) |
| US-07 | System degrades gracefully when external APIs are unavailable | OSRM → Haversine; ML → DB; Gemini → rule-based fallback |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────┐
│           VERCEL (Frontend)             │
│  Next.js 16.3 · React 19 · TailwindCSS │
│                                         │
│  /dashboard /planner /schedules /oracle │
└────────────────┬────────────────────────┘
                 │  REST API calls
┌────────────────▼────────────────────────┐
│          RAILWAY (Backend)              │
│  FastAPI 0.138 · Python 3.13           │
│                                         │
│  GET /congestion  POST /route           │
│  GET /schedules   POST /agent/chat      │
└────────┬──────────────────┬────────────┘
         │                  │
┌────────▼───────┐  ┌───────▼─────────────┐
│  scikit-learn  │  │  SUPABASE (Cloud DB) │
│  RandomForest  │  │  road_segments       │
│  95.1% acc.    │  │  congestion_mults    │
│  rf_model.joblib│ │  ferry_schedules     │
└────────────────┘  └─────────────────────┘
```

---

## ✨ Features

### 🗺️ Route Planner
- Input origin and destination as `lat, lng` coordinates
- Live route rendering via React Leaflet with OSRM GeoJSON polyline
- Auto-zoom and fitBounds on route result
- Displays: Distance, Congestion-adjusted duration, Congestion level, CO₂ estimate
- Inline error display if API fails

### 📅 Ferry Schedules
- Full schedule table fetched live from Supabase
- Columns: Departure time, Vessel type, Terminal, Destination, Cargo capacity
- Trip count derived dynamically from database records
- Loading state with spinner; polished empty state with Retry button

### 🤖 Logistic Oracle (AI Chat)
- Powered by Google Gemini 2.5 Flash with function-calling
- 3 registered tools: `get_congestion_level`, `get_ferry_schedule`, `get_optimal_route`
- Quick-action suggestion chips for common queries
- Typing animation while AI is responding
- Fallback message if Gemini quota exceeded

### 📊 Dashboard Overview
- Live port congestion badge for Yos Sudarso (SEG001) from ML API
- Next 3 Ferry Departures sorted from real schedule data
- Total Emission Saved (estimated from route optimization)
- Quick Action Cards linking to Planner, Schedules, Oracle

### 🔐 Authentication
- Email/password registration and login
- Google OAuth single sign-on
- JWT session management via Supabase Auth
- Protected routes via Next.js proxy middleware

---

## 🛠️ Technology Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16.3.1 (Turbopack) | React framework, SSR, routing |
| React | 19.2.8 | UI components |
| TypeScript | ^5 | Type safety |
| TailwindCSS | ^4 | Utility-first styling |
| shadcn/ui | ^4.18 | Component library |
| Leaflet + React Leaflet | 1.9.4 / ^5.0.0 | Interactive map |
| Lucide React | ^1.31.0 | Icons |
| @supabase/ssr | ^0.12.4 | Supabase Auth for Next.js |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Python | 3.13.0 | Runtime |
| FastAPI | 0.138.0 | REST API framework |
| Uvicorn | latest | ASGI server |
| Supabase Python SDK | 2.31.0 | PostgreSQL client |
| scikit-learn | 1.9.0 | Random Forest ML model |
| joblib | 1.5.3 | Model serialization |
| google-generativeai | latest | Gemini 2.5 Flash + function-calling |
| Requests | latest | OSRM external API calls |
| python-dotenv | latest | .env loading |

### Infrastructure

| Service | Provider | Purpose |
|---|---|---|
| PostgreSQL | Supabase Cloud | Primary data store |
| Authentication | Supabase Auth | JWT + Google OAuth |
| Frontend Deployment | Vercel | Auto-deploy from GitHub main |
| Backend Deployment | Railway | Containerized FastAPI |
| Routing Engine | OSRM Public API | Road routing GeoJSON |
| AI Model | Google Gemini 2.5 Flash | NL logistics assistant |

---

## 📡 API Documentation

**Base URL (Production):** `https://smartflow-api.up.railway.app`

### GET `/congestion`

Predict road segment congestion using the trained Random Forest model.

**Query Parameters:**
- `segment_id` (string, required) — e.g. `SEG001` to `SEG006`
- `day_type` (string, required) — `weekday` or `weekend`
- `hour` (integer, required) — 0–23

**Example:** `GET /congestion?segment_id=SEG001&day_type=weekday&hour=8`

**Response:**
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

---

### POST `/route`

Calculate optimal route with congestion-adjusted travel time and emission estimate.

**Request:**
```json
{
  "origin": { "lat": 1.1291, "lng": 104.0494 },
  "destination": { "lat": 1.1633, "lng": 104.0044 },
  "time": "08:00",
  "day_type": "weekday"
}
```

**Response:**
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
  "route_geometry": { "type": "LineString", "coordinates": [...] }
}
```

---

### GET `/schedules`

Retrieve all ferry schedules from Supabase.

**Response:**
```json
{
  "schedules": [
    {
      "id": "uuid",
      "terminal_name": "Batam Center",
      "destination": "Singapore",
      "departure_times": ["06:00", "08:00", "10:00"],
      "vessel_type": "High-Speed Catamaran",
      "cargo_capacity_tons": 12
    }
  ]
}
```

---

### POST `/agent/chat`

Send a natural language message to the AI logistics assistant.

**Request:** `{ "message": "What is the congestion at Yos Sudarso right now?" }`

**Response:** `{ "reply": "Based on current data, Yos Sudarso (SEG001) is experiencing HIGH congestion..." }`

**Gemini Tools:**
- `get_congestion_level(segment_id, day_type, hour)` → calls real ML API
- `get_ferry_schedule(terminal)` → queries Supabase
- `get_optimal_route(origin, destination)` → returns routing data

---

## 🗄️ Database Schema

### `road_segments` — 6 records
Tracks Batam road segments (Yos Sudarso, Sudirman, Batu Ampar access, etc.)
- `segment_id TEXT (PK)`, `name`, `corridor_type`, `start_lat/lng`, `end_lat/lng`, `length_km`, `typical_speed_kmh`

### `congestion_multipliers` — 25 records
Full hourly congestion coverage per segment.
- `segment_id (FK)`, `day_type`, `hour_start`, `hour_end`, `congestion_level`, `multiplier`, `description`

### `ferry_schedules` — 20 records
All Batam terminal departure schedules.
- `terminal_name`, `destination`, `departure_times TEXT[]`, `vessel_type`, `cargo_capacity_tons`, `cutoff_time`

### `route_query_log`
Historical route query store for analytics.
- `id`, `created_at`, `origin`, `destination`, `result_json`

---

## 🤖 Machine Learning Model

**File:** `backend/rf_model.joblib` (310 KB)  
**Algorithm:** Random Forest Classifier (`sklearn.ensemble`)

| Spec | Value |
|---|---|
| Estimators | 50 trees |
| Training samples | 14,400 synthetic rows |
| Features | 7 (hour, is_peak, day_type_*, corridor_type_*) |
| Target classes | `low`, `medium`, `high` |
| Overall accuracy | **95.1%** |
| F1 (LOW / MEDIUM / HIGH) | 0.98 / 0.84 / 0.77 |

**Multiplier map:** `low → 1.066×` · `medium → 1.227×` · `high → 1.818×`

**Fallback chain:** ML inference → Supabase DB window lookup → `LOW 1.0×` default

---

## 🚀 Deployment

### Frontend — Vercel

**Live URL:** `https://frontend-nine-blue-dx6g6mxt1e.vercel.app`

- Auto-deploys from GitHub `main` on every push
- Build command: `npm run build` | Output: `.next`

**Environment Variables:**
```
NEXT_PUBLIC_API_URL=https://smartflow-api.up.railway.app
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

### Backend — Railway

**Live URL:** `https://smartflow-api.up.railway.app`

- Auto-deploys from GitHub `main` on every push
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

**Environment Variables:**
```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
GEMINI_API_KEY=<gemini-key>
```

---

## ⚙️ Local Development Setup

### Prerequisites
- Python 3.13+ · Node.js 20+ · npm

### 1. Clone
```bash
git clone https://github.com/mhddanial/hackathon.git
cd hackathon
```

### 2. Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install fastapi uvicorn supabase google-generativeai scikit-learn joblib python-dotenv requests
cp .env.example .env    # Fill in your keys
uvicorn main:app --reload
# → http://127.0.0.1:8000  |  Swagger: /docs
```

### 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env.local    # Fill in your keys
npm run dev
# → http://localhost:3000
```

---

## 🔑 Environment Variables

### Backend `.env`
```env
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=eyJ...
GEMINI_API_KEY=AIza...
```

### Frontend `.env.local`
```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## 📁 Project Structure

```
hackathon/
├── backend/
│   ├── main.py                  # FastAPI app, CORS, router registration
│   ├── database.py              # Supabase client factory
│   ├── agent_config.py          # Gemini system prompt & tool schemas
│   ├── rf_model.joblib          # Trained Random Forest (310 KB)
│   ├── railway.json             # Railway deployment config
│   ├── routers/
│   │   ├── agent.py             # POST /agent/chat — Gemini function calling
│   │   ├── congestion.py        # GET /congestion — ML + DB fallback
│   │   ├── route.py             # POST /route — OSRM + ML + Haversine
│   │   ├── schedules.py         # GET /schedules — Supabase query
│   │   └── user.py              # GET /user/history
│   ├── scripts/
│   │   └── prepare_data.py      # Data cleaning & Supabase import
│   └── database/
│       └── schema.sql           # PostgreSQL schema (4 tables)
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx         # Sidebar + Topbar shell
│   │   │   │   ├── dashboard/page.tsx # Live congestion + departures
│   │   │   │   ├── planner/page.tsx   # Route optimization + Leaflet map
│   │   │   │   ├── schedules/page.tsx # Ferry schedule table
│   │   │   │   └── oracle/page.tsx    # AI chat interface
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── auth/callback/         # OAuth callback
│   │   ├── components/
│   │   │   ├── MapComponent.tsx        # Leaflet map (polyline, markers)
│   │   │   ├── MapView.tsx             # Dynamic import (no SSR)
│   │   │   ├── layout/Sidebar.tsx
│   │   │   ├── layout/Topbar.tsx
│   │   │   └── providers/AuthProvider.tsx
│   │   └── utils/supabase/             # Auth client helpers
│   ├── proxy.ts                        # Route protection middleware
│   └── package.json
│
└── docs/
    ├── BUILDER_A.md             # Backend developer task tracker
    └── methodology_notes.md    # ML model methodology notes
```

---

## 🏆 Hackathon Summary

**Team:** Builder A (Backend/ML) + Builder B (Frontend/UX)  
**Duration:** 16-hour sprint  
**Theme:** Cross-border logistics intelligence, Singapore–Batam corridor

**Key Achievements:**
- ✅ Random Forest model trained in-hackathon — 95.1% accuracy
- ✅ Full Gemini function-calling pipeline (NL → tool → real data → NL)
- ✅ OSRM + ML hybrid routing with automatic Haversine fallback
- ✅ Complete auth system (Email + Google OAuth + SSR route protection)
- ✅ 5 fully integrated API endpoints deployed on Railway
- ✅ 4-page dashboard on Vercel, all wired to live backend APIs

---

*Built with ❤️ from I Can Do IT*


