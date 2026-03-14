#!/usr/bin/env python3
"""
BTC INDEX Backend_NEW / 01_fetch_historical.py
──────────────────────────────────────────────
BGeometrics API에서 각 온체인 지표의 전체 과거 데이터를 수집하여
data/historical_onchain.json 파일로 저장합니다.

실행 방법:
    cd "BTC INDEX Backend_NEW"
    python3 01_fetch_historical.py

주의:
    - 무료 티어 15회/일, 8회/시간 제한. 지표 7개 × 최대 2페이지 = 14회 이내.
    - 도중에 429 에러가 발생하면 자동으로 60초 대기 후 재시도합니다.
"""

import json
import os
import time
import urllib.request
import urllib.error
from datetime import datetime
from typing import Dict, List, Optional, Any

from config import (
    BASE_URL, REQUEST_TIMEOUT, PAGE_SIZE, RATE_LIMIT_DELAY,
    INDICATORS, RESPONSE_VALUE_KEYS,
    HISTORICAL_FILE, DATA_DIR,
)

# 200주 = 1400일
WMA_200_DAYS = 1400


# ─── 유틸리티 함수 ──────────────────────────────────────────────────────────

def fetch_page(endpoint: str, start_day: str, page: int = 0, size: int = PAGE_SIZE,
               is_retry: bool = False) -> Optional[Any]:
    """BGeometrics API를 호출하여 한 페이지 분량의 데이터를 가져옵니다.
    429 발생 시 1회만 재시도합니다 (무한루프 방지)."""
    url = (
        f"{BASE_URL}/{endpoint}"
        f"?startday={start_day}"
        f"&page={page}&size={size}"
    )
    print(f"    → GET {url}")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        if e.code == 429:
            if is_retry:
                # 이미 1회 재시도했으면 스킵
                print(f"    ❌ 429 재시도 실패 — 시간당 한도 초과. 지표 건너뚄.")
                return None
            print(f"    ⚠️ 429 Rate Limit. 65초 대기 후 1회 재시도...")
            time.sleep(65)
            return fetch_page(endpoint, start_day, page, size, is_retry=True)  # 단 1회
        print(f"    ❌ HTTP {e.code}: {e.reason}")
        return None
    except Exception as ex:
        print(f"    ❌ 요청 오류: {ex}")
        return None


def unwrap_records(raw: Any) -> List[Dict]:
    """다양한 BGeometrics 응답 형식을 레코드 리스트로 정규화합니다."""
    if isinstance(raw, list):
        return raw
    # Spring Pageable: {"content": [...], "totalElements": N, ...}
    if isinstance(raw, dict) and "content" in raw:
        return raw["content"]
    # HAL _embedded: {"_embedded": {"metricList": [...]}}
    if isinstance(raw, dict) and "_embedded" in raw:
        embedded = raw["_embedded"]
        return list(embedded.values())[0] if embedded else []
    return []


def total_pages(raw: Any, size: int) -> int:
    """응답에서 전체 페이지 수를 계산합니다."""
    if isinstance(raw, dict):
        total_el = raw.get("totalElements", 0)
        if total_el:
            return (int(total_el) + size - 1) // size
        if "totalPages" in raw:
            return int(raw["totalPages"])
    return 1   # 리스트 응답이면 단일 페이지로 간주


def extract_date(record: Dict) -> Optional[str]:
    """레코드에서 날짜 문자열(YYYY-MM-DD)을 추출합니다."""
    d = record.get("d") or record.get("date") or record.get("day")
    if not d:
        return None
    return str(d)[:10]    # Funding Rate는 datetime 형식이므로 앞 10자만


def extract_value(record: Dict, endpoint: str) -> Optional[float]:
    """레코드에서 해당 지표 값을 추출합니다."""
    field = RESPONSE_VALUE_KEYS.get(endpoint)
    if field and field in record:
        val = record[field]
        try:
            return float(val)
        except (TypeError, ValueError):
            return None
    # 필드 이름이 미매핑인 경우 첫 번째 숫자 값 반환
    for k, v in record.items():
        if k not in ("d", "date", "day", "unixTs") and v is not None:
            try:
                return float(v)
            except (TypeError, ValueError):
                continue
    return None


# ─── 핵심 수집 함수 ─────────────────────────────────────────────────────────

def fetch_all_records(indicator: Dict) -> Dict[str, Optional[float]]:
    """
    특정 지표의 모든 과거 데이터를 날짜→값 딕셔너리로 반환합니다.
    페이지네이션이 있으면 자동으로 모든 페이지를 순회합니다.
    """
    endpoint: str = indicator["endpoint"]
    start: str    = indicator["start"]
    name: str     = indicator["name"]

    print(f"\n  [{name}] 수집 시작 (start: {start})")
    result: Dict[str, Optional[float]] = {}

    # Page 0 먼저 가져오기
    raw = fetch_page(endpoint, start, page=0)
    if raw is None:
        print(f"  ❌ [{name}] 첫 페이지 수집 실패. 건너뜀.")
        return result

    records = unwrap_records(raw)
    n_pages = total_pages(raw, PAGE_SIZE)
    print(f"    총 {n_pages}페이지 예상 (현재 {len(records)}개 레코드)")

    for rec in records:
        d = extract_date(rec)
        if d:
            result[d] = extract_value(rec, endpoint)

    # 페이지가 2개 이상이면 추가 수집
    for page in range(1, n_pages):
        print(f"    [{name}] 페이지 {page}/{n_pages - 1} 수집 중...")
        time.sleep(RATE_LIMIT_DELAY)
        raw = fetch_page(endpoint, start, page=page)
        if raw is None:
            print(f"    ⚠️ 페이지 {page} 실패. 이후 데이터 누락될 수 있음.")
            break
        for rec in unwrap_records(raw):
            d = extract_date(rec)
            if d:
                result[d] = extract_value(rec, endpoint)

    print(f"  ✅ [{name}] 수집 완료: {len(result)}개 레코드 (최초: {min(result.keys(), default='?')}, 최후: {max(result.keys(), default='?')})")
    return result


# ─── 병합 및 저장 ───────────────────────────────────────────────────────────

def merge_and_save(all_data: Dict[str, Dict[str, Optional[float]]]):
    """
    지표별 날짜→값 딕셔너리를 날짜 기준으로 병합하여
    [{d: ..., wma_200: ..., mvrv_z: ..., ...}, ...] 배열로 저장합니다.
    200 Week MA(1400일 이동평균)는 btc-price 데이터를 기반으로 자체 계산합니다.
    """
    # 모든 날짜 수집 (union)
    all_dates = set()
    for values in all_data.values():
        all_dates.update(values.keys())

    sorted_dates = sorted(all_dates)
    print(f"\n  병합: 총 {len(sorted_dates)}일 ({sorted_dates[0] if sorted_dates else '?'} ~ {sorted_dates[-1] if sorted_dates else '?'})")

    # ── 200WMA 사전 계산 ────────────────────────────────────────────────
    # price 데이터(일별)를 날짜 순으로 가져와 누적 리스트 구성
    price_map = all_data.get("btc-price", {})
    price_series = [(d, price_map.get(d)) for d in sorted_dates if price_map.get(d) is not None]

    # 날짜 → 200WMA 딕셔너리 생성
    wma_map: Dict[str, Optional[float]] = {}
    prices_so_far: List[float] = []
    price_series_idx = 0
    for d in sorted_dates:
        p = price_map.get(d)
        if p is not None:
            prices_so_far.append(float(p))
        # 1400일치 이상 쌓였으면 평균 계산, 아니면 None
        if len(prices_so_far) >= WMA_200_DAYS:
            window = prices_so_far[-WMA_200_DAYS:]
            wma_map[d] = round(sum(window) / len(window), 2)
        else:
            wma_map[d] = None

    print(f"  200WMA 계산 완료: {sum(1 for v in wma_map.values() if v is not None)}일에 유효값")

    # ── 병합 ────────────────────────────────────────────────────────────
    output = []
    for d in sorted_dates:
        row: Dict[str, Any] = {"d": d}
        # 200WMA 먼저 삽입
        row["wma_200"] = wma_map.get(d)
        for indicator in INDICATORS:
            key = indicator["key"]
            endpoint = indicator["endpoint"]
            val = all_data.get(endpoint, {}).get(d)

            # nullable_before 처리: 해당 지표 출범 이전 날짜는 null 유지
            nullable_before = indicator.get("nullable_before")
            if nullable_before and d < nullable_before:
                val = None

            row[key] = val
        output.append(row)

    # 저장
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(HISTORICAL_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, separators=(",", ":"))

    size_kb = os.path.getsize(HISTORICAL_FILE) / 1024
    print(f"  💾 저장 완료: {HISTORICAL_FILE}")
    print(f"     총 {len(output)}개 레코드 / 파일 크기: {size_kb:.1f} KB")


# ─── 메인 ───────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print(f"  BTC Onchain Historical Fetcher")
    print(f"  실행 시각: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  수집 지표: {len(INDICATORS)}개")
    print("=" * 60)

    all_data: Dict[str, Dict[str, Optional[float]]] = {}

    # 기존 저장 파일이 있으면 로드 ("resume" 모드)
    if os.path.exists(HISTORICAL_FILE):
        try:
            existing = json.load(open(HISTORICAL_FILE, "r", encoding="utf-8"))
            print(f"  ⚠️ 기존 {HISTORICAL_FILE} 감지 ({len(existing)}일). 이어서 수집 시작합니다.")
        except Exception:
            pass

    for i, indicator in enumerate(INDICATORS):
        if i > 0:
            print(f"\n  ⏳ 다음 지표까지 {RATE_LIMIT_DELAY}초 대기 (API 제한 준수)...")
            time.sleep(RATE_LIMIT_DELAY)

        endpoint = indicator["endpoint"]
        records = fetch_all_records(indicator)
        all_data[endpoint] = records

        # 429로 수집 실패한 경우 지금까지 수집된 데이터 바로 저장
        if records:
            print(f"  💾 중간 저장 중... ({endpoint}: {len(records)}개)")
            merge_and_save(all_data)
        else:
            print(f"  ⚠️ [{indicator['name']}] 데이터 없음 — 429 한도 소진. 나머지 지표는 다음 실행 시 수집 예정.")
            break

    print("\n" + "=" * 60)
    # 실제로 수집된 데이터가 있을 때만 저장 (빈 데이터로 기존 파일 덮어쓰기 방지)
    total_records = sum(len(v) for v in all_data.values())
    if total_records > 0:
        merge_and_save(all_data)
        print("\n✅ 수집 완료 (또는 오늘 한도 소진 도중 중단)!")
    else:
        print("\n⚠️ 수집된 데이터 없음 — API 한도 소진 상태. 기존 파일 유지.")
    print(f"   파일 위치: {HISTORICAL_FILE}")
    print("=" * 60)


if __name__ == "__main__":
    main()
