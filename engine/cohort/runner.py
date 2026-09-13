#!/usr/bin/env python3
"""Fixed stdin/stdout bridge for the server-side Coh Cohort DNA engine."""

import json
import sys

from scouter_cohort_engine import CohortDNAEngine


def main() -> None:
    profile = json.load(sys.stdin)
    result = CohortDNAEngine().score(profile, top_current=None)
    json.dump(result, sys.stdout, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"cohort-engine: {type(error).__name__}: {error}", file=sys.stderr)
        raise SystemExit(1)
