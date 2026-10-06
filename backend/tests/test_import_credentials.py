"""Import credential checks run before client creation or workbook uploads."""

from pathlib import Path
import runpy

import dotenv
import pytest
import supabase

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "prepare_data.py"


@pytest.mark.parametrize("service_key", [None, "test-anon-key"])
def test_import_refuses_missing_or_anonymous_credentials(monkeypatch, capsys, service_key):
    monkeypatch.setattr(dotenv, "load_dotenv", lambda **kwargs: None)
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "test-anon-key")
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    if service_key:
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", service_key)
    monkeypatch.setattr(supabase, "create_client", lambda *args: pytest.fail("Client must not be created"))
    with pytest.raises(SystemExit) as error:
        runpy.run_path(str(SCRIPT))
    assert error.value.code == 1
    assert "test-anon-key" not in capsys.readouterr().out


def test_import_uses_only_separate_server_credential(monkeypatch):
    monkeypatch.setattr(dotenv, "load_dotenv", lambda **kwargs: None)
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "test-anon-key")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-server-only-key")
    calls = []

    class StopBeforeUpload(Exception):
        pass

    def create_client(url, key):
        calls.append((url, key))
        raise StopBeforeUpload

    monkeypatch.setattr(supabase, "create_client", create_client)
    with pytest.raises(StopBeforeUpload):
        runpy.run_path(str(SCRIPT))
    assert calls == [("https://example.supabase.co", "test-server-only-key")]
