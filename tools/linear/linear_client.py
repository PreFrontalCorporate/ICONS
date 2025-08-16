#!/usr/bin/env python3
import os, requests, sys, time, random

API = "https://api.linear.app/graphql"
KEY = os.environ.get("LINEAR_API_KEY", "")

class LinearHTTPError(RuntimeError):
    pass

def gql(query: str, variables: dict | None = None, max_retries: int = 5, timeout: int = 30):
    if not KEY:
        raise RuntimeError("LINEAR_API_KEY is not set in the environment.")
    payload = {"query": query, "variables": variables or {}}
    headers = {
        "Content-Type": "application/json",
        "Authorization": KEY,  # Linear in your workspace wants the *raw* key (no 'Bearer ')
        "User-Agent": "icon-linear-tools/0.3",
    }
    delay = 1.0
    for attempt in range(1, max_retries + 1):
        try:
            r = requests.post(API, json=payload, headers=headers, timeout=timeout)
            status = r.status_code
            if status == 200:
                try:
                    data = r.json()
                except ValueError:
                    if attempt < max_retries:
                        time.sleep(delay + random.random())
                        delay = min(delay * 2, 10)
                        continue
                    raise LinearHTTPError(f"Non-JSON 200 response: {r.text[:500]}")
                if "errors" in data:
                    # GraphQL-level error (usually not retriable)
                    raise RuntimeError(data["errors"])
                return data.get("data")
            # Non-200: decide if retriable
            retriable = (status == 429) or (500 <= status < 600)
            try:
                body = r.json()
            except Exception:
                body = r.text
            if retriable and attempt < max_retries:
                time.sleep(delay + random.random())
                delay = min(delay * 2, 10)
                continue
            sys.stderr.write(f"Linear HTTP error {status}\nResponse: {str(body)[:2000]}\n")
            r.raise_for_status()
        except requests.exceptions.RequestException:
            # Network-layer (e.g., Connection reset by peer). Retry.
            if attempt < max_retries:
                time.sleep(delay + random.random())
                delay = min(delay * 2, 10)
                continue
            raise
