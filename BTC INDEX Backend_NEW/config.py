"""
BTC INDEX Backend_NEW - 공통 설정
BGeometrics API 기반 온체인 데이터 수집 설정값
"""

import os

# ─── API 기본 설정 ─────────────────────────────────────────────────────────────
BASE_URL = "https://bitcoin-data.com/v1"
REQUEST_TIMEOUT = 15          # 초
PAGE_SIZE = 5000              # 1회 요청당 최대 레코드 수 (서버 허용 상한 시도)
RATE_LIMIT_DELAY = 8          # 요청 간 대기 초 (시간당 8회 제한 준수)

# ─── 수집 지표 정의 ──────────────────────────────────────────────────────────
# endpoint:  /v1/{endpoint}
# key:       historical_onchain.json에 저장될 필드명
# start:     데이터가 존재하는 최초 날짜 (실제 확인값 기준)
# nullable_before: 이 날짜 이전 데이터는 null (해당 지표 출범 이전)
INDICATORS = [
    {
        "name": "BTC Price",
        "endpoint": "btc-price",
        "key": "price",
        "start": "2010-07-17",
        "nullable_before": None,
    },
    {
        "name": "MVRV Z-Score",
        "endpoint": "mvrv-zscore",
        "key": "mvrv_z",
        "start": "2009-01-03",
        "nullable_before": None,
    },
    {
        "name": "Reserve Risk",
        "endpoint": "reserve-risk",
        "key": "reserve_risk",
        "start": "2012-01-01",
        "nullable_before": None,
    },
    {
        "name": "STH-SOPR",
        "endpoint": "sth-sopr",
        "key": "sth_sopr",
        "start": "2012-01-01",
        "nullable_before": None,
    },
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
        "nullable_before": "2019-01-01",  # 이전은 null
    },
    {
        "name": "Realized Cap",
        "endpoint": "realized-cap",
        "key": "realized_cap",
        "start": "2010-01-01",
        "nullable_before": None,
    },
]

# ─── 응답 키 매핑 ─────────────────────────────────────────────────────────────
# BGeometrics 응답 JSON의 값 필드명 → 우리 key로 매핑
RESPONSE_VALUE_KEYS = {
    "btc-price":      "btcPrice",       # {"d":..., "btcPrice":...}
    "mvrv-zscore":    "mvrvZscore",
    "reserve-risk":   "reserveRisk",
    "sth-sopr":       "sthSopr",
    "puell-multiple": "puellMultiple",
    "funding-rate":   "fundingRate",
    "realized-cap":   "realizedCap",
}

# ─── 저장 경로 ────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")

HISTORICAL_FILE = os.path.join(DATA_DIR, "historical_onchain.json")
LATEST_FILE     = os.path.join(DATA_DIR, "latest.json")
