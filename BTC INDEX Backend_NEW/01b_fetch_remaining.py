#!/usr/bin/env python3
"""
01b_fetch_remaining.py
─────────────────────
01_fetch_historical.py 실행 후 미수집된 지표만 이어서 수집합니다.
현재 대상: Puell Multiple, Funding Rate, Realized Cap

실행 방법:
    cd "BTC INDEX Backend_NEW"
    python3 01b_fetch_remaining.py
"""

import json, os, time, urllib.request, urllib.error
from datetime import datetime
from typing import Dict, List, Optional, Any

from config import (
    BASE_URL, REQUEST_TIMEOUT, PAGE_SIZE, RATE_LIMIT_DELAY,
    RESPONSE_VALUE_KEYS, HISTORICAL_FILE, DATA_DIR,
)

# ─── 수집할 나머지 지표만 정의 ──────────────────────────────────────────────
REMAINING_INDICATORS = [
    {
        "name": "Puell Multiple",
        "endpoint": "puell-multiple",
        "key": "puell",
        "start": "2012-05-01",
        "nullable_before": None,
    },
    {
        "name": "Funding Rate",
        "endpoint": "funding-rate",
        "key": "funding_rate",
        "start": "2019-01-01",
        "nullable_before": "2019-01-01",
    },
    {
        "name": "Realized Cap",
        "endpoint": "realized-cap",
        "key": "realized_cap",
        "start": "2010-01-01",
        "nullable_before": None,
    },
]

WMA_200_DAYS = 1400


def fetch_page(endpoint: str, start_day: str, page: int = 0,
               size: int = PAGE_SIZE, is_retry: bool = False) -> Optional[Any]:
    url = f"{BASE_URL}/{endpoint}?startday={start_day}&page={page}&size={size}"
    print(f"    → GET {url}")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        if e.code == 429:
            if is_retry:
                print(f"    ❌ 429 재시도 실패 — 시간당 한도 초과. 건너뜀.")
                return None
            print(f"    ⚠️ 429 Rate Limit. 65초 대기 후 1회 재시도...")
            time.sleep(65)
            return fetch_page(endpoint, start_day, page, size, is_retry=True)
        print(f"    ❌ HTTP {e.code}: {e.reason}")
        return None
    except Exception as ex:
        print(f"    ❌ 오류: {ex}")
        return None


def unwrap(raw: Any) -> List[Dict]:
    if isinstance(raw, list): return raw
    if isinstance(raw, dict) and "content" in raw: return raw["content"]
    if isinstance(raw, dict) and "_embedded" in raw:
        emb = raw["_embedded"]
        return list(emb.values())[0] if emb else []
    return []


def total_pages(raw: Any, size: int) -> int:
    if isinstance(raw, dict):
        total_el = raw.get("totalElements", 0)
        if total_el: return (int(total_el) + size - 1) // size
        if "totalPages" in raw: return int(raw["totalPages"])
    return 1


def fetch_indicator(indicator: Dict) -> Dict[str, Optional[float]]:
    endpoint = indicator["endpoint"]
    start    = indicator["start"]
    name     = indicator["name"]
    print(f"\n  [{name}] 수집 시작 (start: {start})")
    result: Dict[str, Optional[float]] = {}

    raw = fetch_page(endpoint, start, page=0)
    if raw is None:
        print(f"  ❌ [{name}] 첫 페이지 수집 실패. 건너뜀.")
        return result

    records = unwrap(raw)
    n_pages = total_pages(raw, PAGE_SIZE)
    print(f"    총 {n_pages}페이지 (현재 {len(records)}개)")

    for rec in records:
        d = str(rec.get("d") or rec.get("date") or rec.get("day") or "")[:10]
        if not d: continue
        field = RESPONSE_VALUE_KEYS.get(endpoint)
        val = rec.get(field) if field else None
        try:
            result[d] = float(val) if val is not None else None
        except (TypeError, ValueError):
            result[d] = None

    for pg in range(1, n_pages):
        print(f"    [{name}] 페이지 {pg}/{n_pages-1}...")
        time.sleep(RATE_LIMIT_DELAY)
        raw = fetch_page(endpoint, start, page=pg)
        if raw is None:
            print(f"    ⚠️ 페이지 {pg} 실패.")
            break
        for rec in unwrap(raw):
            d = str(rec.get("d") or rec.get("date") or rec.get("day") or "")[:10]
            if not d: continue
            field = RESPONSE_VALUE_KEYS.get(endpoint)
            val = rec.get(field) if field else None
            try:
                result[d] = float(val) if val is not None else None
            except (TypeError, ValueError):
                result[d] = None

    nullable_before = indicator.get("nullable_before")
    if nullable_before:
        for d in list(result.keys()):
            if d < nullable_before:
                result[d] = None

    print(f"  ✅ [{name}] 완료: {len(result)}개 "
          f"(최초: {min(result, default='?')}, 최후: {max(result, default='?')})")
    return result


def merge_into_existing(new_data: Dict[str, Dict[str, Optional[float]]]) -> None:
    """기존 historical_onchain.json에 새 지표 값을 병합합니다."""
    if not os.path.exists(HISTORICAL_FILE):
        print("  ❌ historical_onchain.json 없음. 먼저 01_fetch_historical.py 실행 필요.")
        return

    with open(HISTORICAL_FILE, "r", encoding="utf-8") as f:
        existing = json.load(f)

    print(f"\n  기존 파일: {len(existing)}개 레코드")

    # 날짜→인덱스 맵
    date_idx = {row["d"]: i for i, row in enumerate(existing)}

    updated = 0
    for indicator in REMAINING_INDICATORS:
        key      = indicator["key"]
        endpoint = indicator["endpoint"]
        vals     = new_data.get(endpoint, {})
        if not vals:
            continue
        for d, val in vals.items():
            if d in date_idx:
                existing[date_idx[d]][key] = val
                updated += 1
            else:
                # 기존 파일에 없는 날짜는 새 행으로 추가
                new_row: Dict[str, Any] = {"d": d}
                for ind in REMAINING_INDICATORS:
                    new_row[ind["key"]] = new_data.get(ind["endpoint"], {}).get(d)
                existing.append(new_row)
                date_idx[d] = len(existing) - 1

    existing.sort(key=lambda r: r.get("d", ""))

    # 200WMA 재계산 (price 기준)
    prices_so_far: List[float] = []
    for row in existing:
        p = row.get("price")
        if p is not None:
            try: prices_so_far.append(float(p))
            except (TypeError, ValueError): pass
        if len(prices_so_far) >= WMA_200_DAYS:
            row["wma_200"] = round(sum(prices_so_far[-WMA_200_DAYS:]) / WMA_200_DAYS, 2)
        else:
            if "wma_200" not in row:
                row["wma_200"] = None

    os.makedirs(DATA_DIR, exist_ok=True)
    with open(HISTORICAL_FILE, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, separators=(",", ":"))

    size_kb = os.path.getsize(HISTORICAL_FILE) / 1024
    print(f"  💾 업데이트 완료: {HISTORICAL_FILE}")
    print(f"     총 {len(existing)}개 레코드 / {size_kb:.1f} KB / 필드 업데이트: {updated}개")


def main():
    print("=" * 60)
    print(f"  BTC Onchain — 나머지 지표 수집")
    print(f"  실행 시각: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  대상: Puell Multiple, Funding Rate, Realized Cap")
    print("=" * 60)

    new_data: Dict[str, Dict[str, Optional[float]]] = {}

    for i, indicator in enumerate(REMAINING_INDICATORS):
        if i > 0:
            print(f"\n  ⏳ {RATE_LIMIT_DELAY}초 대기...")
            time.sleep(RATE_LIMIT_DELAY)

        endpoint = indicator["endpoint"]
        records  = fetch_indicator(indicator)
        new_data[endpoint] = records

        if records:
            print(f"  💾 중간 병합 저장 중...")
            merge_into_existing(new_data)
        else:
            print(f"  ⚠️ [{indicator['name']}] 수집 실패 — 429 한도 소진. 중단.")
            break

    print("\n" + "=" * 60)
    print("✅ 나머지 지표 수집 완료!")
    print(f"   파일: {HISTORICAL_FILE}")
    print("=" * 60)


if __name__ == "__main__":
    main()
