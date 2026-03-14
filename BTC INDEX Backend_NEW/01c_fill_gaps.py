#!/usr/bin/env python3
"""
01c_fill_gaps.py
────────────────
날짜별 누락된 구간(2026-03-12 ~ 2026-03-13)의 데이터를 수집하여 
historical_onchain.json에 병합합니다.
"""

import json, os, time, urllib.request, urllib.error
from datetime import datetime
from typing import Dict, List, Optional, Any

from config import (
    BASE_URL, REQUEST_TIMEOUT, PAGE_SIZE, RATE_LIMIT_DELAY,
    RESPONSE_VALUE_KEYS, HISTORICAL_FILE, INDICATORS
)

GAP_START = "2026-03-12"
GAP_END   = "2026-03-13"

def fetch_range(endpoint: str, start: str) -> Dict[str, Optional[float]]:
    url = f"{BASE_URL}/{endpoint}?startday={start}&size=100"
    print(f"    → GET {url}")
    result = {}
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            raw = json.loads(resp.read())
            
            # unwrap
            records = []
            if isinstance(raw, list): records = raw
            elif isinstance(raw, dict) and "content" in raw: records = raw["content"]
            elif isinstance(raw, dict) and "_embedded" in raw:
                emb = raw["_embedded"]
                records = list(emb.values())[0] if emb else []

            field = RESPONSE_VALUE_KEYS.get(endpoint)
            for rec in records:
                d = str(rec.get("d") or rec.get("date") or rec.get("day") or "")[:10]
                if GAP_START <= d <= GAP_END:
                    val = rec.get(field) if field else None
                    try:
                        result[d] = float(val) if val is not None else None
                    except (TypeError, ValueError):
                        result[d] = None
    except Exception as e:
        print(f"    ❌ 오류: {e}")
    return result

def main():
    if not os.path.exists(HISTORICAL_FILE):
        print("Historical file not found.")
        return

    with open(HISTORICAL_FILE, "r", encoding="utf-8") as f:
        historical = json.load(f)

    print(f"Filling gaps between {GAP_START} and {GAP_END}...")
    
    gap_data = {}
    for i, indicator in enumerate(INDICATORS):
        if i > 0: time.sleep(RATE_LIMIT_DELAY)
        print(f"  [{indicator['name']}] 조회 중...")
        vals = fetch_range(indicator["endpoint"], GAP_START)
        for d, v in vals.items():
            if d not in gap_data: gap_data[d] = {"d": d}
            gap_data[d][indicator["key"]] = v

    # Merge
    new_rows = [gap_data[d] for d in sorted(gap_data.keys())]
    historical.extend(new_rows)
    historical.sort(key=lambda x: x["d"])

    # 200WMA Recalculate for all
    prices = []
    WMA_200_DAYS = 1400
    for row in historical:
        p = row.get("price")
        if p is not None: prices.append(p)
        if len(prices) >= WMA_200_DAYS:
            window = prices[-WMA_200_DAYS:]
            row["wma_200"] = round(sum(window) / len(window), 2)
        else:
            row["wma_200"] = None

    with open(HISTORICAL_FILE, "w", encoding="utf-8") as f:
        json.dump(historical, f, ensure_ascii=False, separators=(",", ":"))
    
    print(f"Successfully filled gaps. Total records: {len(historical)}")

if __name__ == "__main__":
    main()
