-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Road Segments Table
CREATE TABLE public.road_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    corridor_type TEXT NOT NULL,
    start_lat FLOAT8 NOT NULL,
    start_lng FLOAT8 NOT NULL,
    end_lat FLOAT8 NOT NULL,
    end_lng FLOAT8 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Congestion Multipliers Table
CREATE TABLE public.congestion_multipliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    segment_id UUID REFERENCES public.road_segments(id) ON DELETE CASCADE,
    day_type TEXT NOT NULL, -- 'weekday' or 'weekend'
    hour_start INT NOT NULL,
    hour_end INT NOT NULL,
    multiplier FLOAT8 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Ferry Schedules Table
CREATE TABLE public.ferry_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    terminal TEXT NOT NULL,
    destination TEXT NOT NULL,
    departure_time TIME NOT NULL,
    operator TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Route Query Log Table (Optional, for analytics)
CREATE TABLE public.route_query_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    recommended_departure TIME,
    result_json JSONB
);

-- Insert Dummy Data for initial testing

-- Dummy Road Segments
INSERT INTO public.road_segments (id, name, corridor_type, start_lat, start_lng, end_lat, end_lng)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Yos Sudarso (Batu Ampar - Kabil)', 'industrial_arterial', 1.1633, 104.0183, 1.1275, 104.0883),
  ('22222222-2222-2222-2222-222222222222', 'Sudirman (Batam Center)', 'urban_arterial', 1.1272, 104.0560, 1.1095, 104.0381);

-- Dummy Congestion Multipliers
INSERT INTO public.congestion_multipliers (segment_id, day_type, hour_start, hour_end, multiplier)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'weekday', 6, 9, 2.5),  -- Peak morning
  ('11111111-1111-1111-1111-111111111111', 'weekday', 9, 16, 1.2), -- Off-peak
  ('11111111-1111-1111-1111-111111111111', 'weekday', 16, 19, 2.2), -- Peak evening
  ('22222222-2222-2222-2222-222222222222', 'weekday', 6, 9, 2.0),
  ('22222222-2222-2222-2222-222222222222', 'weekday', 9, 16, 1.1),
  ('22222222-2222-2222-2222-222222222222', 'weekday', 16, 19, 2.8);

-- Dummy Ferry Schedules
INSERT INTO public.ferry_schedules (terminal, destination, departure_time, operator)
VALUES 
  ('batam_center', 'Harbourfront, Singapore', '06:00:00', 'Batam Fast'),
  ('batam_center', 'Harbourfront, Singapore', '07:15:00', 'Majestic Fast Ferry'),
  ('batu_ampar', 'Harbourfront, Singapore', '08:00:00', 'Horizon Ferry');
