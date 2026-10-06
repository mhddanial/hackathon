"""Verify public REST permissions without retaining rows or printing credentials."""

import json
from pathlib import Path
from uuid import uuid4

from dotenv import dotenv_values
import requests

config = dotenv_values(Path(__file__).resolve().parents[1] / ".env")
url = config["SUPABASE_URL"].rstrip("/")
key = config["SUPABASE_ANON_KEY"]
checks = []
with requests.Session() as session:
    session.headers.update({"apikey": key, "Authorization": "Bearer " + key})
    for table in ("road_segments", "congestion_multipliers", "ferry_schedules", "route_query_log"):
        for method in ("GET", "POST", "PATCH", "DELETE"):
            # Empty inserts violate required fields even if a write were allowed.
            # Update/delete targets are new random UUIDs, never existing rows.
            params = {"select": "id", "limit": "1"} if method == "GET" else {}
            if method in ("PATCH", "DELETE"):
                params["id"] = "eq." + str(uuid4())
            payload = {} if method == "POST" else {"id": str(uuid4())} if method == "PATCH" else None
            response = session.request(method, url + "/rest/v1/" + table,
                                       params=params, json=payload, timeout=15)
            body = response.json()
            code = body.get("code") if isinstance(body, dict) else None
            allowed_read = method == "GET" and table != "route_query_log"
            passed = response.status_code == 200 if allowed_read else response.status_code in (401, 403) and code == "42501"
            checks.append({"table": table, "method": method, "http_status": response.status_code,
                           "database_error_code": code, "passed": passed})
report = {"checks": checks, "passed": sum(check["passed"] for check in checks),
          "scope": "Live anonymous REST reads/writes; no persistent rows or credentials retained"}
output = Path(__file__).resolve().parents[2] / "docs/oracle/evidence/legacy-rls/live-rest.json"
output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"passed": report["passed"], "total": len(checks)}))
raise SystemExit(0 if all(check["passed"] for check in checks) else 1)
