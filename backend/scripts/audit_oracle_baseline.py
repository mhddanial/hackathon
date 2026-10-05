"""Read-only Sprint 0 audit. Never prints env values, tokens, or row content.

Run from any directory using backend/.venv/Scripts/python.exe. Optional --output
writes sanitized JSON evidence. Does not call the AI provider or mutate the DB.
"""

import argparse
import ast
import contextlib
import io
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
from datetime import datetime, timezone
from urllib.parse import urlparse

import requests
from dotenv import dotenv_values


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"


def error_kind(exc):
    """Class names are useful evidence without leaking URLs or credentials."""
    return type(exc).__name__


def run_audit():
    backend_env = {**dotenv_values(BACKEND / ".env"), **os.environ}
    frontend_env = dotenv_values(ROOT / "frontend" / ".env.local")
    report = {
        "checked_at_utc": datetime.now(timezone.utc).isoformat(),
        "scope": "read-only; no provider invocation, login, user creation, or migration",
        "git": {
            "branch": subprocess.check_output(
                ["git", "branch", "--show-current"], cwd=ROOT, text=True
            ).strip(),
            "head": subprocess.check_output(
                ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
            ).strip(),
        },
        "configuration": {
            "backend": {
                key: bool(backend_env.get(key))
                for key in ("SUPABASE_URL", "SUPABASE_ANON_KEY", "LIGHTNING_API_KEY")
            },
            "frontend": {
                key: bool(frontend_env.get(key) or os.environ.get(key))
                for key in (
                    "NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_SUPABASE_URL",
                    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
                )
            },
            "direct_database_access_configured": any(
                backend_env.get(key) for key in ("DATABASE_URL", "SUPABASE_DB_URL")
            ),
            "two_user_test_credentials_configured": all(
                backend_env.get(key)
                for key in (
                    "ORACLE_TEST_USER_A_EMAIL", "ORACLE_TEST_USER_A_PASSWORD",
                    "ORACLE_TEST_USER_B_EMAIL", "ORACLE_TEST_USER_B_PASSWORD",
                )
            ),
        },
    }
    paths = [p for p in BACKEND.rglob("*.py") if ".venv" not in p.parts]
    syntax_errors = []
    for path in paths:
        try:
            ast.parse(path.read_text(encoding="utf-8-sig"))
        except SyntaxError as exc:
            syntax_errors.append({"file": path.relative_to(ROOT).as_posix(), "line": exc.lineno})
    report["python_syntax"] = {
        "status": "fail" if syntax_errors else "pass",
        "files": len(paths), "errors": syntax_errors,
    }

    url = backend_env.get("SUPABASE_URL", "").rstrip("/")
    key = backend_env.get("SUPABASE_ANON_KEY", "")
    report["supabase"] = {}
    host = urlparse(url).hostname if url else None
    if host:
        try:
            socket.getaddrinfo(host, 443)
            report["supabase"]["dns"] = {"status": "pass"}
        except OSError as exc:
            report["supabase"]["dns"] = {"status": "unavailable", "error_kind": error_kind(exc)}
    else:
        report["supabase"]["dns"] = {"status": "unavailable", "reason": "URL missing"}

    if url and key and report["supabase"]["dns"]["status"] == "pass":
        headers = {"apikey": key, "Authorization": f"Bearer {key}"}
        session = requests.Session()
        for name, endpoint in (("auth_health", "/auth/v1/health"), ("rest_schema", "/rest/v1/")):
            try:
                response = session.get(url + endpoint, headers=headers, timeout=(5, 10))
                result = {"status": "pass" if response.ok else "fail", "http_status": response.status_code}
                if name == "rest_schema" and response.ok:
                    schema = response.json()
                    result["visible_tables"] = {
                        name: sorted(definition.get("properties", {}))
                        for name, definition in schema.get("definitions", {}).items()
                    }
                    result["limitation"] = "Only schema visible to configured API role; does not prove RLS policies."
                report["supabase"][name] = result
            except (requests.RequestException, ValueError) as exc:
                report["supabase"][name] = {"status": "unavailable", "error_kind": error_kind(exc)}
        # Fetch at most one public schedule row; retain only status/count/columns.
        try:
            response = session.get(
                url + "/rest/v1/ferry_schedules", headers=headers,
                params={"select": "*", "limit": 1}, timeout=(5, 10),
            )
            result = {"status": "pass" if response.ok else "fail", "http_status": response.status_code}
            if response.ok:
                rows = response.json()
                result.update({"sample_rows": len(rows), "columns": sorted(rows[0]) if rows else []})
            report["supabase"]["public_schedule_read"] = result
        except (requests.RequestException, ValueError) as exc:
            report["supabase"]["public_schedule_read"] = {"status": "unavailable", "error_kind": error_kind(exc)}
        # limit=0 probes expose no stored messages or user records.
        report["supabase"]["table_contract_probes"] = {}
        for table, columns in (
            ("road_segments", "segment_id,corridor_type"),
            ("congestion_multipliers", "segment_id,day_type,hour_start,hour_end"),
            ("route_query_log", "user_id"),
            ("conversations", "id,user_id"),
            ("chat_messages", "id,conversation_id,user_id"),
        ):
            try:
                response = session.get(
                    url + "/rest/v1/" + table, headers=headers,
                    params={"select": columns, "limit": 0}, timeout=(5, 10),
                )
                result = {"http_status": response.status_code, "select": columns}
                if response.ok:
                    result["status"] = "visible_contract"
                else:
                    result["status"] = "unavailable_contract"
                    result["database_error_code"] = response.json().get("code")
                report["supabase"]["table_contract_probes"][table] = result
            except (requests.RequestException, ValueError) as exc:
                report["supabase"]["table_contract_probes"][table] = {
                    "status": "unavailable", "error_kind": error_kind(exc)
                }
        report["supabase"]["table_probe_limitation"] = (
            "Probes establish only API-role visibility/column contracts, not complete schema or RLS definitions."
        )
        session.close()
    else:
        for name in ("auth_health", "rest_schema", "public_schedule_read"):
            report["supabase"][name] = {"status": "unavailable", "reason": "DNS or configuration prerequisite failed"}

    # Import the real app, suppressing existing startup logs. No provider call.
    sys.path.insert(0, str(BACKEND))
    previous_cwd = Path.cwd()
    try:
        os.chdir(BACKEND)
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            from fastapi.testclient import TestClient
            from main import app
            from routers import congestion

            with TestClient(app) as client:
                health = client.get("/health")
                history = client.get("/user/history")
                openapi = app.openapi()
                if report["supabase"]["auth_health"]["status"] == "pass":
                    invalid_auth = client.get(
                        "/user/history", headers={"Authorization": "Bearer sprint-zero-invalid-token"}
                    )
                    report["invalid_token_history"] = {
                        "http_status": invalid_auth.status_code,
                        "rejected": invalid_auth.status_code in (401, 403),
                    }
                if report["supabase"]["public_schedule_read"]["status"] == "pass":
                    congestion_response = client.get(
                        "/congestion", params={"segment_id": "SEG001", "day_type": "weekday", "hour": 8}
                    )
                    result = {"http_status": congestion_response.status_code}
                    if congestion_response.is_success:
                        result["body"] = congestion_response.json()
                    report["live_data_backed_congestion"] = result
            report["backend_in_process"] = {
                "health": {"http_status": health.status_code, "body": health.json()},
                "history_without_token": {
                    "http_status": history.status_code,
                    "rejected": history.status_code in (401, 403),
                },
                "chat_requires_auth_in_openapi": bool(
                    openapi["paths"]["/agent/chat"]["post"].get("security")
                ),
                "history_requires_auth_in_openapi": bool(
                    openapi["paths"]["/user/history"]["get"].get("security")
                ),
                "chat_request_fields": sorted(openapi["components"]["schemas"]["ChatRequest"]["properties"]),
                "limitation": "In-process requests prove current app wiring, not network service or authenticated ownership.",
            }
            report["model_artifact"] = {
                "loaded": congestion.rf_model is not None,
                "feature_columns": list(congestion.feature_columns or []),
                "estimator_count": getattr(congestion.rf_model, "n_estimators", None),
                "classes": [str(x) for x in getattr(congestion.rf_model, "classes_", [])],
                "limitation": "Artifact loaded; training metrics and runtime data-backed predictions not verified.",
            }
    except Exception as exc:
        report["backend_in_process"] = {"status": "unavailable", "error_kind": error_kind(exc)}
    finally:
        os.chdir(previous_cwd)

    report["live_policy_inspection"] = {
        "status": "pending", "reason": "API schema alone does not expose PostgreSQL policy definitions; authorized catalog access is required."
    }
    report["authenticated_two_user_checks"] = {
        "status": "pending", "reason": "No credentials are requested, printed, or created by this audit."
    }
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    evidence = json.dumps(run_audit(), indent=2, ensure_ascii=False)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(evidence + "\n", encoding="utf-8")
    print(evidence)
