import json
from datetime import datetime


def parse_pytest_report(report_path: str, run_id: str, endpoints: list[dict]) -> list[dict]:
    """
    Parse a pytest-json-report output file and return a list of trace dicts
    ready to be saved via tracer.save_trace().
    """
    with open(report_path, encoding="utf-8") as f:
        report = json.load(f)

    # Build a quick lookup: test name fragment → endpoint
    def _match_endpoint(nodeid: str) -> dict | None:
        for ep in endpoints:
            method = ep["method"].lower()
            path_fragment = ep["path"].replace("/", "_").replace("{", "").replace("}", "").strip("_")
            if method in nodeid and path_fragment in nodeid:
                return ep
        return None

    traces = []
    for test in report.get("tests", []):
        nodeid: str = test.get("nodeid", "")
        outcome: str = test.get("outcome", "")  # "passed" | "failed" | "error" | "skipped"
        duration: float = test.get("duration", 0) * 1000  # convert s → ms

        passed = outcome == "passed"
        error_message = None
        if not passed and outcome != "skipped":
            call = test.get("call", {})
            error_message = call.get("longrepr", "")

        ep = _match_endpoint(nodeid)
        endpoint_path = ep["path"] if ep else "unknown"
        method = ep["method"] if ep else "UNKNOWN"
        tag = ep.get("tag") if ep else None

        traces.append({
            "endpoint": endpoint_path,
            "method": method,
            "url": "",  # not available from pytest report
            "payload": {},
            "response_body": {},
            "status_code": 200 if passed else 0,
            "time_taken_ms": duration,
            "source": "pytest",
            "test_name": nodeid.split("::")[-1],
            "test_run_id": run_id,
            "tag": tag,
            "passed": passed if outcome != "skipped" else None,
            "error_message": error_message,
        })

    return traces
