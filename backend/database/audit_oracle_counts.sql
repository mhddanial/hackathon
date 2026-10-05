-- Aggregate-only preservation evidence; no user/message records returned.
SELECT jsonb_build_object(
  'server_version', current_setting('server_version'),
  'user_count', (SELECT count(*) FROM auth.users),
  'legacy_counts', jsonb_build_object(
    'road_segments', (SELECT count(*) FROM public.road_segments),
    'congestion_multipliers', (SELECT count(*) FROM public.congestion_multipliers),
    'ferry_schedules', (SELECT count(*) FROM public.ferry_schedules),
    'route_query_log', (SELECT count(*) FROM public.route_query_log),
    'profiles', (SELECT count(*) FROM public.profiles)
  )
) AS audit;
