#!/usr/bin/env python3
import hashlib, html, json, re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCES=json.loads((ROOT/"signal-sources.json").read_text())
OUT=ROOT/"signal-feed.json"
NOW=datetime.now(timezone.utc)
CUTOFF=NOW-timedelta(days=45)

def clean(value, limit=320):
    value=html.unescape(re.sub(r"<[^>]+>"," ",value or ""))
    value=re.sub(r"\\s+"," ",value).strip()
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

def fetch(url):
    request=urllib.request.Request(url,headers={"User-Agent":"SensoryLog-Signal/1.0"})
    with urllib.request.urlopen(request,timeout=12) as response:
        return response.read(1_500_000)

def parse_source(source):
    root=ET.fromstring(fetch(source["feed"]))
    rows=[]
    for item in root.findall(".//item") + root.findall(".//{*}entry"):
        title=clean(first_text(item,["title"]),140)
        link=first_text(item,["link"])
        if not link:
            link_node=item.find(".//{*}link")
            link=(link_node.attrib.get("href","") if link_node is not None else "")
        if not title or not link or not link.startswith(("http://","https://")):
            continue
        raw_date=first_text(item,["pubDate","published","updated","date"])
        date=parse_date(raw_date)
        if not date or date<CUTOFF or date>NOW+timedelta(days=1):
            continue
        summary=clean(first_text(item,["description","summary","content","encoded"]))
        if not summary:
            summary="New update from "+source["name"]+"."
        digest=hashlib.sha256(link.encode()).hexdigest()[:16]
        rows.append({
            "id":source["id"]+"-"+digest,
            "type":source["type"],
            "date":date.date().isoformat(),
            "title":title,
            "text":summary,
            "source":source["name"],
            "sourceUrl":link,
            "note":"Automatically collected from an approved publisher feed."
        })
    return rows

items=[]
for source in SOURCES:
    try:
        items.extend(parse_source(source)[:8])
    except Exception as exc:
        print("Signal source failed:",source["id"],str(exc))

seen=set()
unique=[]
for item in sorted(items,key=lambda x:(x["date"],x["id"]),reverse=True):
    key=item["sourceUrl"].rstrip("/")
    if key in seen:
        continue
    seen.add(key)
    unique.append(item)
    if len(unique)>=24:
        break

payload={"version":1,"generatedAt":NOW.replace(microsecond=0).isoformat().replace("+00:00","Z"),"items":unique}
OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n")
print("Wrote",len(unique),"Signal items")
