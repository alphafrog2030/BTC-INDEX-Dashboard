
import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional

class OnchainAnalyzer:
    """
    비트코인 온체인 지표의 역사적 데이터를 분석하여 
    '블렌디드 적응형(Blended Adaptive)' 점수를 산출합니다.
    """
    
    WINDOW_DAYS = 1460  # 4년 (반감기 주기)
    
    # 지표별 가중치 (프론트엔드 marketService.ts와 동일하게 설정)
    WEIGHTS = {
        "mvrv_z_score": 0.25,
        "reserve_risk": 0.20,
        "sth_sopr": 0.15,
        "puell_multiple": 0.15,
        "funding_rate": 0.15,
        "wma_ratio": 0.10
    }

    def __init__(self, historical_data: List[Dict[str, Any]]):
        self.df = pd.DataFrame(historical_data)
        self.df['d'] = pd.to_datetime(self.df['d'])
        self.df = self.df.set_index('d').sort_index()
        
        # 200WMA Ratio 미리 계산
        if 'price' in self.df.columns and 'wma_200' in self.df.columns:
            self.df['wma_ratio'] = self.df['price'].astype(float) / self.df['wma_200'].astype(float)
            
        # MVRV Z-Score 60일 기울기 계산 (시뮬레이터용)
        if 'mvrv_z' in self.df.columns:
            # 60일 전과의 수치 차이를 기울기로 정의 (전처리용)
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

    def get_blended_percentile_score(self, indicator_key: str, current_val: float) -> int:
        """
        특정 지표의 현재 수치가 8년(두 사이클) 블렌딩 기준 몇 점인지 산출합니다.
        """
        if indicator_key not in self.df.columns:
            return 5
            
        latest_date = self.df.index.max()
        four_years_ago = latest_date - pd.Timedelta(days=self.WINDOW_DAYS)
        eight_years_ago = latest_date - pd.Timedelta(days=self.WINDOW_DAYS * 2)
        
        # 주기별 데이터 분할
        recent_vals = self.df.loc[four_years_ago:latest_date, indicator_key].dropna().astype(float)
        prior_vals = self.df.loc[eight_years_ago:four_years_ago, indicator_key].dropna().astype(float)
        
        if recent_vals.empty or prior_vals.empty:
            return 5

        # 지표별 임계값 백분위 (P10: 매수, P90: 매도)
        # Funding Rate와 SOPR은 변동성이 크므로 좁은 구간 사용
        p_buy = 10
        p_sell = 90
        
        r_p10, r_p90 = np.percentile(recent_vals, p_buy), np.percentile(recent_vals, p_sell)
        p_p10, p_p90 = np.percentile(prior_vals, p_buy), np.percentile(prior_vals, p_sell)
        
        # 블렌딩 (1:1)
        blended_buy = (r_p10 + p_p10) / 2
        blended_sell = (r_p90 + p_p90) / 2
        blended_med = (recent_vals.median() + prior_vals.median()) / 2
        
        # 점수 산출 (선형 보간 근사)
        # 10점(강력매수) <--- blended_buy --- blended_med --- blended_sell ---> 0점(강력매도)
        
        # Funding Rate 및 SOPR은 특수 처리 (1.0 혹은 0 근처가 중립)
        if indicator_key == "sth_sopr":
            blended_med = 1.0
        elif indicator_key == "funding_rate":
            blended_med = 0.01

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
            if val is not None:
                score = self.get_blended_percentile_score(key, val)
                weight = self.WEIGHTS.get(key, 0)
                indicator_scores[key] = {
                    "value": val,
                    "score": score,
                    "weight": weight,
                    "signal": "BUY" if score >= 8 else ("SELL" if score <= 2 else "NEUTRAL")
                }
                total_weighted_score += score * weight
            else:
                indicator_scores[key] = {"value": None, "score": 5, "weight": self.WEIGHTS.get(key, 0), "signal": "NEUTRAL"}
        
        total_score = round(total_weighted_score * 10, 1) # 0-100 scale
        
        return {
            "total_score": total_score,
            "overall_signal": "BUY" if total_score >= 70 else ("SELL" if total_score <= 30 else "NEUTRAL"),
            "indicators": indicator_scores
        }
