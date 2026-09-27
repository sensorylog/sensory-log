#!/usr/bin/env python3
import json, re
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
POLICY=json.loads((ROOT/"signal-policy.json").read_text())
FEED=json.loads((ROOT/"signal-feed.json").read_text())
ALLOWED=set(POLICY["allowedTypes"])
if FEED.get("version") != 1 or not isinstance(FEED.get("items"), list):
    raise SystemExit("Invalid Signal feed envelope")

if len(FEED["items"]) > POLICY["maxItems"]:
    raise SystemExit("Signal feed exceeds maximum item count")

ids=set()
urls=set()
titles=set()
for item in FEED["items"]:
    required=("id","type","date","title","text","source","sourceUrl")
    if any(not isinstance(item.get(key),str) or not item[key].strip() for key in required):
        raise SystemExit("Signal item missing required fields")
    if item["id"] in ids:
        raise SystemExit("Duplicate Signal id")
    ids.add(item["id"])
    if item["type"] not in ALLOWED:
        raise SystemExit("Unsupported Signal type: "+item["type"])
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}",item["date"]):
        raise SystemExit("Invalid Signal date")
    datetime.strptime(item["date"],"%Y-%m-%d").replace(tzinfo=timezone.utc)
    if len(item["title"]) > 180 or len(item["text"]) > 500:
        raise SystemExit("Signal title/text exceeds limit")
    if not item["sourceUrl"].startswith("https://"):
        raise SystemExit("Signal source URL must use HTTPS")
    url=item["sourceUrl"].split("#",1)[0].rstrip("/")
    title=re.sub(r"\s+"," ",re.sub(r"[^a-z0-9]+"," ",item["title"].lower())).strip()
    if url in urls or title in titles:
        raise SystemExit("Duplicate Signal URL/title")
    urls.add(url)
    titles.add(title)

print("Signal feed validation passed:",len(FEED["items"]),"items")
