
import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional

class OnchainAnalyzer:
    """
    비트코인 온체인 지표의 역사적 데이터를 분석하여
    '블렌디드 적응형(Blended Adaptive)' 점수를 산출합니다.
    """

    WINDOW_DAYS = 1400  # 200주 × 7일

    # 지표별 가중치 (프론트엔드 marketService.ts와 동일하게 설정)
    WEIGHTS = {
        "mvrv_z_score": 0.25,
        "reserve_risk": 0.20,
        "sth_sopr": 0.15,
        "puell_multiple": 0.15,
        "funding_rate": 0.15,
        "wma_ratio": 0.10
    }

    # 역사적 데이터 없을 때 사용할 정적 임계값 (BTC 사이클 실증 기준)
    # buy: 이 값 이하면 10점(강력매수), sell: 이 값 이상이면 0점(강력매도)
    # ─ reserve_risk : 바닥권 실측값 0.0003~0.001 기준 강화, 2021 고점 0.03 반영
    # ─ sth_sopr     : 항복 기준 0.970으로 강화, 과열 기준 1.050으로 완화
    # ─ puell_multiple: 채굴자 항복 실증치 ≤0.5, 사이클 고점 3.5~5.0 반영
    # ─ funding_rate  : 유의미한 매수 신호는 -0.0002 이하, 과열은 0.0005 이상
    STATIC_THRESHOLDS = {
        "reserve_risk":   {"buy": 0.0010,   "sell": 0.025,   "med": 0.006},
        "sth_sopr":       {"buy": 0.970,    "sell": 1.050,   "med": 1.000},
        "puell_multiple": {"buy": 0.500,    "sell": 3.500,   "med": 1.000},
        "funding_rate":   {"buy": -0.0002,  "sell": 0.0005,  "med": 0.0001},
    }

    # analyze() 내 지표 키 → df 컬럼명 매핑 (이름 불일치 해소)
    _KEY_TO_COL = {
        "mvrv_z_score": "mvrv_z",
    }

    def __init__(self, historical_data: List[Dict[str, Any]]):
        self.df = pd.DataFrame(historical_data)
        self.df['d'] = pd.to_datetime(self.df['d'])
        self.df = self.df.set_index('d').sort_index()

        # 시뮬레이터용 단축 컬럼명(p,z,ma,s) → 분석기 장문 컬럼명으로 정규화
        rename_map = {'p': 'price', 'z': 'mvrv_z', 'ma': 'wma_ratio', 's': 'mvrv_slope'}
        self.df = self.df.rename(columns={
            k: v for k, v in rename_map.items()
            if k in self.df.columns and v not in self.df.columns
        })

        # 200WMA Ratio 미리 계산 (price/wma_200 형식 원본 데이터 대응)
        if 'price' in self.df.columns and 'wma_200' in self.df.columns and 'wma_ratio' not in self.df.columns:
            self.df['wma_ratio'] = self.df['price'].astype(float) / self.df['wma_200'].astype(float)

        # MVRV Z-Score 60일 기울기 계산 (시뮬레이터용)
        if 'mvrv_z' in self.df.columns and 'mvrv_slope' not in self.df.columns:
            self.df['mvrv_slope'] = self.df['mvrv_z'].diff(60)

    def export_historical_data(self) -> List[Dict[str, Any]]:
        """
        프론트엔드 시뮬레이터(Simulator.tsx)에서 바로 사용할 수 있는 
        형식으로 전체 역사적 데이터를 가공하여 반환합니다.
        """
        export_df = self.df.copy().reset_index()
        
        # 필드명 매핑 (Backend -> Frontend Simulator)
        # d: Date, p: Price, z: MVRV Z-Score, ma: 200MA Ratio, s: Slope
        export_df = export_df.rename(columns={
            'd': 'd',
            'price': 'p',
            'mvrv_z': 'z',
            'wma_ratio': 'ma',
            'mvrv_slope': 's'
        })
        
        # 필요한 필드만 추출 및 결측치 처리
        final_cols = ['d', 'p', 'z', 'ma', 's']
        # 존재하지 않는 컬럼은 기본값으로 채움
        for col in final_cols:
            if col not in export_df.columns:
                export_df[col] = 0.0
                
        # 날짜 포맷 변경
        export_df['d'] = export_df['d'].dt.strftime('%Y-%m-%d')
        
        # JSON 직렬화 가능한 리스트로 변환 (NaN은 None으로 변환됨)
        return export_df[final_cols].replace({np.nan: None}).to_dict(orient='records')

    def _score_from_thresholds(self, val: float, buy: float, sell: float, med: float) -> int:
        """정적 임계값으로 점수 산출 (역사적 데이터 없을 때 폴백)."""
        if val <= buy:
            return 10
        elif val >= sell:
            return 0
        elif val < med:
            ratio = (med - val) / (med - buy)
            return int(5 + ratio * 5)
        else:
            ratio = (val - med) / (sell - med)
            return int(5 - ratio * 5)

    def get_blended_percentile_score(self, indicator_key: str, current_val: float) -> int:
        """
        특정 지표의 현재 수치가 8년(두 사이클) 블렌딩 기준 몇 점인지 산출합니다.
        역사적 데이터가 없으면 정적 임계값으로 폴백합니다.
        """
        # 키 → 실제 df 컬럼명 변환 (mvrv_z_score → mvrv_z 등)
        col_name = self._KEY_TO_COL.get(indicator_key, indicator_key)

        if col_name not in self.df.columns:
            # 정적 임계값 폴백 (API 한도 초과 등으로 역사 데이터 미보유 지표 대응)
            if indicator_key in self.STATIC_THRESHOLDS:
                t = self.STATIC_THRESHOLDS[indicator_key]
                return self._score_from_thresholds(current_val, t['buy'], t['sell'], t['med'])
            return 5

        latest_date = self.df.index.max()
        four_years_ago = latest_date - pd.Timedelta(days=self.WINDOW_DAYS)
        eight_years_ago = latest_date - pd.Timedelta(days=self.WINDOW_DAYS * 2)

        # 주기별 데이터 분할
        recent_vals = self.df.loc[four_years_ago:latest_date, col_name].dropna().astype(float)
        prior_vals = self.df.loc[eight_years_ago:four_years_ago, col_name].dropna().astype(float)

        if recent_vals.empty or prior_vals.empty:
            return 5

        # 지표별 임계값 백분위 (P10: 매수, P80: 매도)
        # P80 사용: 최근 사이클 MVRV 고점 압축 현상 반영 (2025 고점 3.35 대응)
        p_buy = 10
        p_sell = 80

        r_p10, r_p80 = np.percentile(recent_vals, p_buy), np.percentile(recent_vals, p_sell)
        p_p10, p_p80 = np.percentile(prior_vals, p_buy), np.percentile(prior_vals, p_sell)

        # 블렌딩 (1:1)
        blended_buy = (r_p10 + p_p10) / 2
        blended_sell = (r_p80 + p_p80) / 2
        blended_med = (recent_vals.median() + prior_vals.median()) / 2

        # 점수 산출 (선형 보간 근사)
        # 10점(강력매수) <--- blended_buy --- blended_med --- blended_sell ---> 0점(강력매도)

        # Funding Rate 및 SOPR은 특수 처리 (1.0 혹은 0 근처가 중립)
        if indicator_key == "sth_sopr":
            blended_med = 1.0
        elif indicator_key == "funding_rate":
            blended_med = 0.0001

        if current_val <= blended_buy:
            return 10
        elif current_val >= blended_sell:
            return 0
        elif current_val < blended_med:
            # 매수 영역 (5~10점)
            ratio = (blended_med - current_val) / (blended_med - blended_buy)
            return int(5 + (ratio * 5))
        else:
            # 매도 영역 (0~5점)
            ratio = (current_val - blended_med) / (blended_sell - blended_med)
            return int(5 - (ratio * 5))

    def analyze(self, today_row: Dict[str, Any]) -> Dict[str, Any]:
        """
        오늘의 지표를 분석하여 점수와 신호를 포함한 결과를 반환합니다.
        """
        price = today_row.get("price") or 0
        wma_200 = today_row.get("wma_200") or 1
        wma_ratio = price / wma_200
        
        # 매핑용 키
        mapping = {
            "mvrv_z_score": today_row.get("mvrv_z"),
            "reserve_risk": today_row.get("reserve_risk"),
            "sth_sopr": today_row.get("sth_sopr"),
            "puell_multiple": today_row.get("puell"),
            "funding_rate": today_row.get("funding_rate"),
            "wma_ratio": wma_ratio
        }
        
        indicator_scores = {}
        total_weighted_score = 0.0

        for key, val in mapping.items():
            weight = self.WEIGHTS.get(key, 0)
            if val is not None:
                score = self.get_blended_percentile_score(key, val)
                indicator_scores[key] = {
                    "value": val,
                    "score": score,
                    "weight": weight,
                    "signal": "BUY" if score >= 8 else ("SELL" if score <= 2 else "NEUTRAL")
                }
                total_weighted_score += score * weight
            else:
                # null 지표도 중립(5점)으로 가중 평균에 포함 → 점수 왜곡 방지
                indicator_scores[key] = {"value": None, "score": 5, "weight": weight, "signal": "NEUTRAL"}
                total_weighted_score += 5 * weight

        total_score = round(total_weighted_score * 10, 1)  # 0-100 스케일 (가중치 합=1.0 → ×10)
        
        return {
            "total_score": total_score,
            "overall_signal": "BUY" if total_score >= 70 else ("SELL" if total_score <= 30 else "NEUTRAL"),
            "indicators": indicator_scores
        }
