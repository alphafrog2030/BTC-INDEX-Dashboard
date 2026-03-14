#!/usr/bin/env python3
"""
BTC INDEX Backend_NEW / 02_daily_updater.py
────────────────────────────────────────────
하루 1회 크론잡으로 실행. 다음 두 가지 작업을 수행합니다.

[1] 각 온체인 지표의 오늘 최신값을 BGeometrics API에서 수집
[2] data/historical_onchain.json 에 오늘 행 append (시뮬레이터용)
[3] data/data.json 을 덮어쓰기 (프론트엔드가 즉시 읽는 최신 스냅샷)
[4] git add → commit → push (두 파일 모두)

크론탭 설정 예시 (매일 오전 9시 KST):
    0 0 * * * cd "/path/to/BTC INDEX Backend_NEW" && /usr/bin/python3 02_daily_updater.py >> cron.log 2>&1

실행 방법 (수동):
    cd "BTC INDEX Backend_NEW"
    python3 02_daily_updater.py
"""

import json
import os
import subprocess
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any

from config import (
    BASE_URL, REQUEST_TIMEOUT, RATE_LIMIT_DELAY,
    INDICATORS, RESPONSE_VALUE_KEYS,
    HISTORICAL_FILE, DATA_DIR,
)

# ─── 상수 ────────────────────────────────────────────────────────────────────

WMA_200_DAYS = 1400   # 200주 × 7일

# 기존 프론트엔드가 읽는 data.json 경로
DATA_JSON_FILE = os.path.join(DATA_DIR, "data.json")

# GitHub push 대상 파일 목록 (이 파일들만 커밋)
GIT_FILES_TO_PUSH = [HISTORICAL_FILE, DATA_JSON_FILE]

# ─── 유틸리티 ─────────────────────────────────────────────────────────────────

def today_kst() -> str:
    """한국 시간(KST = UTC+9) 기준 오늘 날짜 YYYY-MM-DD 반환."""
    kst = timezone(timedelta(hours=9))
    return datetime.now(tz=kst).strftime("%Y-%m-%d")


def fetch_latest(endpoint: str) -> Optional[float]:
    """
    /v1/{endpoint}/last 를 호출하여 최신 값 1개를 반환합니다.
    429 발생 시 60초 대기 후 1회 재시도합니다.
    """
    url = f"{BASE_URL}/{endpoint}/last"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            record = json.loads(resp.read())
            field = RESPONSE_VALUE_KEYS.get(endpoint)
            if field and field in record:
                val = record[field]
                return float(val) if val is not None else None
            # 필드 자동 탐지 (fallback)
            for k, v in record.items():
                if k not in ("d", "date", "day", "unixTs") and v is not None:
                    try:
                        return float(v)
                    except (TypeError, ValueError):
                        continue
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print(f"    ⚠️ 429 Rate Limit. 60초 대기 후 재시도...")
            time.sleep(60)
            return fetch_latest(endpoint)
        print(f"    ❌ HTTP {e.code}: {e.reason}")
    except Exception as ex:
        print(f"    ❌ 요청 오류: {ex}")
    return None


# ─── 데이터 수집 ──────────────────────────────────────────────────────────────

def collect_today() -> Dict[str, Any]:
    """모든 지표의 최신값을 수집하여 딕셔너리로 반환합니다."""
    today = today_kst()
    print(f"\n  📡 오늘({today}) 데이터 수집 시작")

    result: Dict[str, Any] = {"d": today}

    for i, indicator in enumerate(INDICATORS):
        if i > 0:
            time.sleep(RATE_LIMIT_DELAY)

        name     = indicator["name"]
        endpoint = indicator["endpoint"]
        key      = indicator["key"]

        print(f"    [{name}] 수집 중...")
        val = fetch_latest(endpoint)
        result[key] = val
        print(f"    [{name}] → {val}")

    return result


# ─── 200WMA 계산 ─────────────────────────────────────────────────────────────

def compute_wma200(historical: List[Dict[str, Any]]) -> Optional[float]:
    """
    historical_onchain.json 의 마지막 WMA_200_DAYS 개 price 값으로
    200 Week MA를 계산합니다.
    """
    prices: List[float] = []
    for row in historical:
        p = row.get("price")
        if p is not None:
            try:
                prices.append(float(p))
            except (TypeError, ValueError):
                pass

    if len(prices) < WMA_200_DAYS:
        # 데이터 부족 시 가용한 전체 평균 반환 (초기 단계)
        return round(sum(prices) / len(prices), 2) if prices else None

    window = prices[-WMA_200_DAYS:]
    return round(sum(window) / len(window), 2)


from analyzer import OnchainAnalyzer

# ─── 파일 저장 ────────────────────────────────────────────────────────────────

def load_historical() -> List[Dict[str, Any]]:
    """historical_onchain.json 을 읽어 반환. 없으면 빈 리스트."""
    if not os.path.exists(HISTORICAL_FILE):
        print(f"  ⚠️ {HISTORICAL_FILE} 없음. 빈 배열로 시작합니다.")
        return []
    with open(HISTORICAL_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_historical(historical: List[Dict[str, Any]], analyzer: Optional[OnchainAnalyzer] = None) -> None:
    """
    historical_onchain.json 파일 저장.
    analyzer가 제공되면 시뮬레이터 호환 형식으로 가공하여 저장합니다.
    """
    os.makedirs(DATA_DIR, exist_ok=True)
    try:
        data_to_save = historical
        if analyzer:
            data_to_save = analyzer.export_historical_data()
            
        with open(HISTORICAL_FILE, 'w', encoding="utf-8") as f:
            json.dump(data_to_save, f, ensure_ascii=False, separators=(",", ":"))
        print(f"  💾 {os.path.basename(HISTORICAL_FILE)} 저장 완료 ({os.path.getsize(HISTORICAL_FILE)/1024:.1f} KB, 총 {len(data_to_save)}개 레코드)")
    except Exception as e:
        print(f"  ❌ 역사적 데이터 저장 실패: {e}")


def fetch_fng() -> Dict[str, Any]:
    """Alternative.me 에서 Fear & Greed Index를 가져옵니다."""
    url = "https://api.alternative.me/fng/"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            data = json.loads(resp.read())
            if "data" in data and len(data["data"]) > 0:
                item = data["data"][0]
                return {
                    "value": int(item["value"]),
                    "classification": item["value_classification"]
                }
    except Exception as e:
        print(f"    ⚠️ Fear & Greed 수집 실패: {e}")
    return {"value": 50, "classification": "Neutral"}


def save_data_json(today_row: Dict[str, Any], analyzer: OnchainAnalyzer) -> None:
    """
    프론트엔드용 data.json 을 최신 값 및 분석 점수와 함께 저장합니다.
    """
    analysis = analyzer.analyze(today_row)
    sentiment = fetch_fng()

    snapshot = {
        "timestamp": datetime.now().isoformat(),
        "total_score": analysis["total_score"],
        "overall_signal": analysis["overall_signal"],
        "market": {
            "current_price_usd": today_row.get("price"),
            "wma_200_usd":       today_row.get("wma_200"),
            "wma_ratio":         analysis["indicators"]["wma_ratio"]["value"],
        },
        "sentiment": sentiment,
        "onchain": {
            "mvrv_z_score":    analysis["indicators"]["mvrv_z_score"],
            "reserve_risk":    analysis["indicators"]["reserve_risk"],
            "sth_sopr":        analysis["indicators"]["sth_sopr"],
            "puell_multiple":  analysis["indicators"]["puell_multiple"],
            "funding_rate":    analysis["indicators"]["funding_rate"],
            "wma_ratio":       analysis["indicators"]["wma_ratio"],
            "realized_cap":    today_row.get("realized_cap"),
        }
    }

    os.makedirs(DATA_DIR, exist_ok=True)
    with open(DATA_JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, ensure_ascii=False, indent=4)
    
    print(f"  💾 data.json 저장 완료 (Score: {analysis['total_score']}, Price: {today_row.get('price'):,.0f})")


# ─── GitHub Push ──────────────────────────────────────────────────────────────

def git_push() -> None:
    """변경된 두 파일을 GitHub에 push합니다."""
    def run_git(args: List[str]) -> subprocess.CompletedProcess:
        # 프로젝트 루트 디렉토리 찾기 (현재 파일의 두 단계 상위)
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        return subprocess.run(
            ["git"] + args,
            capture_output=True, text=True, check=False,
            cwd=project_root
        )

    print("\n  ☁️ GitHub Push 시작...")
    
    # 깃 상태 확인
    st = run_git(["status", "--porcelain"])
    if not st.stdout.strip():
        print("  ℹ️ 변경 사항 없음 — push 생략")
        return

    for fpath in GIT_FILES_TO_PUSH:
        if os.path.exists(fpath):
            run_git(["add", fpath])
            print(f"    git add: {os.path.basename(fpath)}")

    commit_msg = f"Auto-update: {datetime.now().strftime('%Y-%m-%d %H:%M')} KST"
    run_git(["commit", "-m", commit_msg])
    result = run_git(["push"])

    if result.returncode == 0:
        print(f"  🎉 GitHub Push 성공! ({commit_msg})")
    else:
        print(f"  ❌ Push 실패: {result.stderr.strip()}")


# ─── 메인 ────────────────────────────────────────────────────────────────────

def main() -> None:
    today = today_kst()
    print("=" * 60)
    print(f"  BTC Onchain Daily Updater (Advanced)")
    print(f"  실행 시각: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  대상 날짜: {today} (KST)")
    print("=" * 60)

    # ── Step 1: 히스토리 로드 ──────────────────────────────────────────
    historical = load_historical()

    # 오늘 날짜가 이미 있으면 append 생략 (중복 방지)
    already_today = historical and historical[-1].get("d") == today

    # ── Step 2: 오늘 데이터 수집 ───────────────────────────────────────
    today_row = collect_today()

    # ── Step 3: 200WMA 계산 ────────────────────────────────────────────
    # 오늘 price를 임시로 historical 끝에 붙여서 계산 (저장 전)
    temp_hist = historical + [today_row] if not already_today else historical
    wma_200 = compute_wma200(temp_hist)
    today_row["wma_200"] = wma_200
    print(f"\n  📐 200WMA 계산 결과: {wma_200:,.2f}" if wma_200 else "\n  ⚠️ 200WMA: 데이터 부족 (None)")

    # analyzer 초기화 (저장 전에 계산 필드 반영을 위해)
    analyzer = OnchainAnalyzer(historical)

    # ── Step 4: historical_onchain.json 업데이트 (가공 데이터 포함) ─────────
    save_historical(historical, analyzer)

    # ── Step 5: data.json 업데이트 (분석 포함) ────────────────────────
    save_data_json(today_row, analyzer)

    # ── Step 6: GitHub Push ────────────────────────────────────────────
    git_push()

    print("\n✅ 일일 업데이트 및 분석 완료!")
    print("=" * 60)


if __name__ == "__main__":
    main()
