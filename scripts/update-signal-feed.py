#!/usr/bin/env python3
import hashlib, html, json, re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCES=json.loads((ROOT/"signal-sources.json").read_text())
POLICY=json.loads((ROOT/"signal-policy.json").read_text())
OUT=ROOT/"signal-feed.json"
NOW=datetime.now(timezone.utc)
CUTOFF=NOW-timedelta(days=POLICY["maxAgeDays"])
ALLOWED_TYPES=set(POLICY["allowedTypes"])
BLOCKED=[re.compile(pattern,re.IGNORECASE) for pattern in POLICY["blockedPatterns"]]

def clean(value, limit=320):
    value=html.unescape(re.sub(r"<[^>]+>"," ",value or ""))
    value=re.sub(r"\s+"," ",value).strip()
    return value[:limit].rstrip()

def first_text(node, names):
    for name in names:
        found=node.find(".//{*}"+name)
        if found is not None and found.text:
            return found.text
    return ""

def parse_date(value):
    if not value:
        return None
    value=value.strip()
    try:
        return datetime.fromisoformat(value.replace("Z","+00:00")).astimezone(timezone.utc)
    except ValueError:
        pass
    for fmt in ("%a, %d %b %Y %H:%M:%S %z","%a, %d %b %Y %H:%M:%S GMT","%Y-%m-%d"):
        try:
            dt=datetime.strptime(value,fmt)
            return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)
        except ValueError:
            continue
    return None

def canonical_url(url):
    return url.strip().split("#",1)[0].rstrip("/")

def normalized_title(title):
    title=html.unescape(title).lower()
    title=re.sub(r"[^a-z0-9]+"," ",title)
    return re.sub(r"\s+"," ",title).strip()

def is_blocked(title, text):
    haystack=f"{title} {text}"
    return any(pattern.search(haystack) for pattern in BLOCKED)

def fetch(url):
    request=urllib.request.Request(url,headers={"User-Agent":"SensoryLog-Signal/1.1"})
    with urllib.request.urlopen(request,timeout=12) as response:
        return response.read(1_500_000)

def parse_source(source):
    if source.get("type") not in ALLOWED_TYPES:
        raise ValueError("source has an unsupported Signal type")
    feed_url=source.get("feed","")
    if not feed_url.startswith("https://"):
        raise ValueError("source feed must use HTTPS")

    root=ET.fromstring(fetch(feed_url))
    rows=[]
    seen_titles=set()

    for item in root.findall(".//item") + root.findall(".//{*}entry"):
        title=clean(first_text(item,["title"]),140)
        link=first_text(item,["link"])
        if not link:
            link_node=item.find(".//{*}link")
            link=(link_node.attrib.get("href","") if link_node is not None else "")
        link=canonical_url(link)
        if not title or not link or not link.startswith("https://"):
            continue

        raw_date=first_text(item,["pubDate","published","updated","date"])
        date=parse_date(raw_date)
        if not date or date<CUTOFF or date>NOW+timedelta(days=1):
            continue

        summary=clean(first_text(item,["description","summary","content","encoded"]))
        if not summary:
            summary="New update from "+source["name"]+"."
        if is_blocked(title,summary):
            print("Signal item blocked by editorial safety policy:",source["id"],title)
            continue

        title_key=normalized_title(title)
        if title_key in seen_titles:
            continue
        seen_titles.add(title_key)

        digest=hashlib.sha256(link.encode()).hexdigest()[:16]
        rows.append({
            "id":source["id"]+"-"+digest,
            "type":source["type"],
            "date":date.date().isoformat(),
            "title":title,
            "text":summary,
            "source":source["name"],
            "sourceUrl":link,
            "note":"Automatically collected from an approved HTTPS publisher feed; screened for freshness, duplicates, and clearly unsafe actionable claims."
        })
    return rows

items=[]
for source in SOURCES:
    try:
        items.extend(parse_source(source)[:POLICY["maxItemsPerSource"]])
    except Exception as exc:
        print("Signal source failed:",source.get("id","unknown"),str(exc))

seen_urls=set()
seen_titles=set()
unique=[]
for item in sorted(items,key=lambda x:(x["date"],x["id"]),reverse=True):
    url_key=canonical_url(item["sourceUrl"])
    title_key=normalized_title(item["title"])
    if url_key in seen_urls or title_key in seen_titles:
        continue
    seen_urls.add(url_key)
    seen_titles.add(title_key)
    unique.append(item)
    if len(unique)>=POLICY["maxItems"]:
        break

if not unique:
    print("No valid Signal items collected; preserving existing feed.")
    raise SystemExit(0)

payload={"version":1,"generatedAt":NOW.replace(microsecond=0).isoformat().replace("+00:00","Z"),"items":unique}
OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n")
print("Wrote",len(unique),"Signal items")
