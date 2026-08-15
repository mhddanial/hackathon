-- ============================================================
-- Batam SmartFlow — Database Schema v2
-- Updated: kompatibel dengan train_model.ipynb (v2)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- DROP existing tables (fresh start — data dummy lama dibuang)
-- ============================================================
DROP TABLE IF EXISTS public.route_query_log CASCADE;
DROP TABLE IF EXISTS public.congestion_multipliers CASCADE;
DROP TABLE IF EXISTS public.ferry_schedules CASCADE;
DROP TABLE IF EXISTS public.road_segments CASCADE;

-- ============================================================
-- 1. Road Segments Table
--    segment_id: TEXT key (SEG001..SEG006), dipakai notebook
--    length_km & typical_speed_kmh: untuk hitung T_actual & emisi
-- ============================================================
CREATE TABLE public.road_segments (
    id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    segment_id      TEXT    UNIQUE NOT NULL,       -- e.g. 'SEG001'
    name            TEXT    NOT NULL,
    corridor_type   TEXT    NOT NULL,              -- 'industrial_arterial' | 'urban_arterial' | 'access_road'
    origin_name     TEXT,
    destination_name TEXT,
    start_lat       FLOAT8  NOT NULL,
    start_lng       FLOAT8  NOT NULL,
    end_lat         FLOAT8  NOT NULL,
    end_lng         FLOAT8  NOT NULL,
    length_km       FLOAT8  NOT NULL,              -- dipakai endpoint /route
    typical_speed_kmh FLOAT8 NOT NULL,            -- free-flow speed, dipakai hitung T_actual
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. Congestion Multipliers Table
--    segment_id: TEXT FK ke road_segments.segment_id
--    congestion_level: ground-truth label (HIGH/MEDIUM/LOW)
--    hour_start/hour_end: integer (0-24), notebook pakai int()
-- ============================================================
CREATE TABLE public.congestion_multipliers (
    id               UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    segment_id       TEXT    NOT NULL REFERENCES public.road_segments(segment_id) ON DELETE CASCADE,
    day_type         TEXT    NOT NULL,   -- 'weekday' | 'weekend'
    hour_window      TEXT,               -- human-readable, e.g. '06:00-09:00'
    hour_start       INT     NOT NULL,   -- integer jam mulai (0-24)
    hour_end         INT     NOT NULL,   -- integer jam selesai (0-24)
    multiplier       FLOAT8  NOT NULL,
    congestion_level TEXT    NOT NULL,   -- 'HIGH' | 'MEDIUM' | 'LOW'
    description      TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. Ferry Schedules Table
--    Diperluas: tambah terminal_id, terminal_name, cutoff_time,
--    cargo_capacity_tons, vessel_type (untuk filter /route)
-- ============================================================
CREATE TABLE public.ferry_schedules (
    id                   UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    terminal_id          TEXT    NOT NULL,          -- e.g. 'TM001'
    terminal             TEXT    NOT NULL,          -- e.g. 'batu_ampar'
    terminal_name        TEXT,
    destination          TEXT    NOT NULL,
    vessel_type          TEXT,
    departure_time       TIME    NOT NULL,
    cutoff_time          TIME,                      -- batas gate-in (untuk filter /route)
    cargo_capacity_tons  FLOAT8,                    -- opsional filter kargo
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. Route Query Log (analytics — opsional)
-- ============================================================
CREATE TABLE public.route_query_log (
    id                   UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    origin               TEXT    NOT NULL,
    destination          TEXT    NOT NULL,
    requested_at         TIMESTAMPTZ DEFAULT NOW(),
    recommended_departure TIME,
    result_json          JSONB
);

-- ============================================================
-- Indexes untuk query performa
-- ============================================================
CREATE INDEX idx_congestion_segment_day ON public.congestion_multipliers (segment_id, day_type);
CREATE INDEX idx_ferry_terminal ON public.ferry_schedules (terminal);
