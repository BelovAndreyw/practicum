#!/usr/bin/env python3
"""Проверка POST-эндпоинтов на сервере (или локально через API_BASE)."""
import json
import os
import sys
from datetime import datetime, timezone

import requests

BASE = os.environ.get("API_BASE", "https://77.91.93.156/api")
VERIFY_SSL = os.environ.get("VERIFY_SSL", "0") == "1"

results: list[tuple[str, int, str, str]] = []


def call(method: str, path: str, token: str | None = None, json_body=None, form=None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    kwargs = {"headers": headers, "timeout": 30, "verify": VERIFY_SSL}
    if form is not None:
        resp = requests.request(method, f"{BASE}{path}", data=form, **kwargs)
    else:
        resp = requests.request(method, f"{BASE}{path}", json=json_body, **kwargs)
    return resp.status_code, resp.text[:300]


def record(name: str, status: int, body: str, note: str = ""):
    ok = status < 400
    mark = "OK" if ok else "FAIL"
    results.append((name, status, body, note))
    suffix = f" ({note})" if note else ""
    print(f"[{mark}] {status:3} {name}{suffix}")
    if not ok:
        print(f"      {body[:200]}")


def main():
    print(f"Testing POST endpoints at {BASE}\n")

    status, body = call("POST", "/auth/login", json_body={"username": "ivanov_test", "password": "test123"})
    record("POST /auth/login", status, body)
    if status != 200:
        print("\nLogin failed, aborting.")
        sys.exit(1)
    token = json.loads(body)["access_token"]

    status, body = call("POST", "/auth/verify", json_body={"student_id": 124})
    record("POST /auth/verify", status, body)

    # --- team flow ---
    status, body = call("POST", "/team/create", token, json_body={"name": f"Auto Team {datetime.now().strftime('%H%M%S')}"})
    record("POST /team/create", status, body)

    status, prof_body = call("GET", "/team/profile", token)
    profile = json.loads(prof_body) if status == 200 else {}
    team_id = profile.get("team_id")

    if team_id:
        status, body = call("POST", f"/team/{team_id}/invite", token, json_body={})
        record(f"POST /team/{team_id}/invite", status, body)
        invite_token = json.loads(body).get("token") if status == 200 else None
    else:
        invite_token = None
        record("POST /team/{id}/invite", 0, "skipped", "нет team_id после create")

    # --- profile (PATCH used by frontend, included for completeness) ---
    status, body = call("PATCH", "/team/profile", token, json_body={"surname": "Иванов", "name": "Иван", "patronymic": "И."})
    record("PATCH /team/profile", status, body)

    # --- posts (multipart) ---
    status, body = call("POST", "/posts/", token, form={"title": "Test news", "content": "Body from test script"})
    record("POST /posts/", status, body)

    # --- help ---
    status, body = call("POST", "/help", token, json_body={
        "title": "Test help request",
        "description": "Need assistance",
        "help_type": "receiving",
        "format": "both",
    })
    record("POST /help", status, body)

    # --- events ---
    starts = datetime.now(timezone.utc).isoformat()
    status, body = call("POST", "/events", token, json_body={
        "title": "Test Event",
        "description": "Event body",
        "format": "online",
        "starts_at": starts,
        "event_type": "workshop",
        "is_public": True,
    })
    record("POST /events", status, body)

    # --- checkins ---
    status, body = call("POST", "/checkins", token, json_body={
        "week_start_date": starts,
        "content": "Weekly summary from test",
    })
    record("POST /checkins", status, body)

    # --- reports ---
    status, body = call("POST", "/reports", token, form={
        "title": "Test report",
        "description": "Report from test script",
    })
    record("POST /reports", status, body)

    # --- challenges (organizer only) ---
    status, body = call("POST", "/challenges", token, json_body={
        "title": "Test Challenge",
        "description": "Challenge desc",
        "reward_points": 10,
    })
    record("POST /challenges (captain user)", status, body, "ожидаемо 403 без роли teacher/admin")

    if status == 200:
        ch_id = json.loads(body).get("id")
        if ch_id and team_id:
            status, body = call("POST", f"/challenges/{ch_id}/enroll", token, json_body={})
            record(f"POST /challenges/{ch_id}/enroll", status, body)

    # --- join-by-link (needs second user or invalid token test) ---
    if invite_token:
        status, body = call("POST", "/team/join-by-link", token, json_body={"token": invite_token})
        record("POST /team/join-by-link (same captain)", status, body, "ожидаемо 400 если уже в команде")

    print("\n--- Summary ---")
    failed = [r for r in results if r[1] >= 400 or r[1] == 0]
    expected_fail = {"POST /challenges (captain user)"}
    unexpected = [r for r in failed if r[0] not in expected_fail and "ожидаемо" not in r[3]]
    if unexpected:
        print("Неожиданные ошибки:")
        for name, status, body, _ in unexpected:
            print(f"  {status} {name}")
    print(f"Total: {len(results)}, failed: {len(failed)}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
