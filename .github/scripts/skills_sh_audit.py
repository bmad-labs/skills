"""Read the skills.sh security audits (Gen Agent Trust Hub, Socket, Snyk) for every skill.

Usage: python skills_sh_audit.py <owner/repo>
Fails when Gen, Socket or Snyk (the providers `npx skills add` shows) reports status
"fail" or risk HIGH/CRITICAL. Other providers (Runlayer, ZeroLeaks) only warn.
A skill with no audit yet (HTTP 404) is reported as pending, not failed.
Set SKILLS_SH_TOKEN to send a bearer token if the API starts requiring auth.
"""

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

API = "https://skills.sh/api/v1/skills/audit/{source}/{skill}"
BLOCKING_RISK = {"HIGH", "CRITICAL"}
BLOCKING_PROVIDERS = {"agent-trust-hub", "socket", "snyk"}


def fetch(source: str, skill: str) -> dict | None:
    request = urllib.request.Request(API.format(source=source, skill=skill))
    token = os.environ.get("SKILLS_SH_TOKEN")
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return None
        raise


def main() -> int:
    source = sys.argv[1]
    skills = sorted(p.parent.name for p in Path("skills").glob("*/SKILL.md"))
    rows, failed = [], False

    for skill in skills:
        result = fetch(source, skill)
        if result is None:
            print(f"::notice::{skill}: no skills.sh audit yet")
            rows.append(f"| {skill} | pending | | |")
            continue
        for audit in result.get("audits", []):
            status = audit.get("status", "")
            risk = audit.get("riskLevel", "")
            provider = audit.get("provider", "")
            summary = audit.get("summary", "").replace("|", "/").replace("\n", " ")
            blocking = audit.get("slug") in BLOCKING_PROVIDERS
            if blocking and (status == "fail" or risk in BLOCKING_RISK):
                failed = True
                print(f"::error::{skill} / {provider}: {status} {risk} — {summary}")
            elif status in ("warn", "fail") or risk in BLOCKING_RISK:
                print(f"::warning::{skill} / {provider}: {summary}")
            rows.append(f"| {skill} | {provider} | {status} {risk} | {summary[:160]} |")

    report = "\n".join(
        ["## skills.sh security audits", "", "| Skill | Provider | Result | Summary |", "| --- | --- | --- | --- |", *rows]
    )
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        Path(summary_path).write_text(report + "\n", encoding="utf-8")
    print(report)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
