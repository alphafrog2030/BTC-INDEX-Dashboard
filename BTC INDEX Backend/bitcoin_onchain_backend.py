import platform
import subprocess
import re
import sys
import traceback
import os
import json
import io

# Set stdout/stderr to utf-8 to handle emojis on Windows logic
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

import time
import threading
import random
from datetime import datetime

# Optional imports for specific OS features
try:
    import winreg
except ImportError:
    winreg = None

try:
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options as ChromeOptions
except ImportError:
    print("⚠️ selenium not installed.")


# Optional simple fallback for yfinance
try:
    import yfinance as yf
    import pandas as pd
except ImportError:
    yf = None
    pd = None

import requests

# --- [Global Configuration] ---
# Data file to be pushed to GitHub
DATA_FILE = "data.json"

# --- [1] 계산 영역 (Math & Public API) ---

def get_market_basics():
    """
    [계산] 현재가 및 200주 이동평균선(WMA) 계산
    - yfinance를 통해 과거 데이터를 받아 직접 수학적으로 계산합니다.
    """
    try:
        if yf is None or pd is None:
             raise ImportError("yfinance or pandas not installed")

        btc = yf.Ticker("BTC-USD")
        
        # 최근 5년치 주봉 데이터
        hist = btc.history(period="5y", interval="1wk")
        
        if hist.empty:
            raise Exception("No data from yfinance")

        current_price = hist['Close'].iloc[-1]
        
        # 200주 이동평균 계산
        if len(hist) >= 200:
            wma_200 = hist['Close'].rolling(window=200).mean().iloc[-1]
        else:
            wma_200 = hist['Close'].mean() # 데이터 부족 시 전체 평균
            
        # 이격도 계산 (현재가가 200주선 대비 몇 배인지)
        wma_ratio = round(current_price / wma_200, 2) if wma_200 else 0
        
        return {
            "current_price_usd": round(current_price, 2),
            "wma_200_usd": round(wma_200, 2),
            "wma_ratio": wma_ratio # 1.0 근처면 바닥, 2.5 넘으면 과열
        }
    except Exception as e:
        print(f"Market Basics Error: {e}")
        # Fallback using CoinGecko if yfinance fails
        try:
             url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
             res = requests.get(url, timeout=5).json()
             price = res['bitcoin']['usd']
             return {"current_price_usd": price, "wma_200_usd": 0, "wma_ratio": 0}
        except Exception:
            return {"current_price_usd": 0, "wma_200_usd": 0, "wma_ratio": 0}

def get_fear_greed():
    """[API] 공포 탐욕 지수 원본 데이터"""
    try:
        res = requests.get("https://api.alternative.me/fng/", timeout=10)
        data = res.json()['data'][0]
        return {
            "value": int(data['value']),
            "classification": data['value_classification'] 
        }
    except Exception:
        return {"value": 50, "classification": "Unknown"}

# --- [2] 조사 영역 (Crawling & APIs) ---

# Global Lock to prevent spawning multiple browsers at once (not thread-safe)
CRAWLER_LOCK = threading.Lock()

def get_chrome_major_version():
    """설치된 크롬 버전을 동적으로 확인"""
    system_name = platform.system()
    try:
        if system_name == "Windows":
            if winreg is None: return None
            key_path = r"Software\Google\Chrome\BLBeacon"
            try:
                with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path) as key:
                    version, _ = winreg.QueryValueEx(key, "version")
                    return int(version.split('.')[0])
            except OSError:
                try:
                    with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, key_path) as key:
                        version, _ = winreg.QueryValueEx(key, "version")
                        return int(version.split('.')[0])
                except OSError: pass
        elif system_name == "Linux":
            cmd = ["google-chrome", "--version"]
            try:
                output = subprocess.check_output(cmd).decode("utf-8")
                match = re.search(r"(\d+)\.", output)
                if match: return int(match.group(1))
            except subprocess.SubprocessError: pass
        elif system_name == "Darwin": # Mac OS
            cmd = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "--version"]
            try:
                output = subprocess.check_output(cmd).decode("utf-8")
                match = re.search(r"(\d+)\.", output)
                if match: return int(match.group(1))
            except subprocess.SubprocessError: pass
    except Exception as e:
        print(f"⚠️ Chrome Version check failed: {e}")
    return None

def scrape_macromicro_indicators():
    """
    [조사] MacroMicro 온체인 지표 수집 using Selenium (Restart driver per target for stability)
    """
    
    # Acquire Lock (Non-blocking)
    if not CRAWLER_LOCK.acquire(blocking=False):
        print("⚠️ Crawler is already running. Skipping this request.")
        return {}
    
    results = {}

    try:
        # 1. 수집할 타겟 리스트 정의
        targets = [
            { "key": "mvrv_z_score", "url": "https://en.macromicro.me/series/8365/bitcoin-mvrv-zscore", "selector": "div.stat-val > span.val" },
            { "key": "puell_multiple", "url": "https://en.macromicro.me/series/8112/bitcoin-puell-multiple", "selector": "div.stat-val > span.val" },
            { "key": "nupl", "url": "https://en.macromicro.me/series/45910/bitcoin-nupl", "selector": "div.stat-val > span.val" }
        ]
    
        print("🚀 브라우저 초기화 및 전체 데이터 수집 시작 (Sequential)...")
        
        for target in targets:
            driver = None
            try:
                # Launch Driver for EACH request
                s_options = ChromeOptions()
                s_options.add_argument("--headless=new")
                s_options.add_argument("--no-sandbox")
                s_options.add_argument("--disable-dev-shm-usage")
                s_options.add_argument("--disable-gpu")
                s_options.add_argument("--start-maximized")
                s_options.add_argument("--disable-blink-features=AutomationControlled")
                # Updated to Mac OS User-Agent to match local environment and better bypass bot-detection on Mac
                s_options.add_argument("user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
                s_options.add_experimental_option("excludeSwitches", ["enable-automation"])
                s_options.add_experimental_option('useAutomationExtension', False)
                
                driver = webdriver.Chrome(options=s_options)
                
                # Bypass detection
                driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
                    "source": """
                        Object.defineProperty(navigator, 'webdriver', {
                            get: () => undefined
                        })
                    """
                })
                
                print(f"🌐 접속 중: {target['key']} ...")
                driver.get(target['url'])

                # 데이터 로딩 대기 (최대 15초)
                element = WebDriverWait(driver, 15).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, target['selector']))
                )
                
                value_text = element.text.strip()
                try:
                    cleaned_text = value_text.replace('%', '').replace(',', '').strip()
                    value = float(cleaned_text)
                    
                    if "%" in value_text or (target['key'] == 'nupl' and abs(value) > 1.0):
                        value = value / 100.0
                except ValueError:
                    value = value_text 

                results[target['key']] = value
                print(f"✅ 추출 완료: {target['key']} -> {value}")
                
            except Exception as e:
                print(f"❌ {target['key']} 수집 실패: {e}")
                results[target['key']] = None
            
            finally:
                if driver:
                    try: driver.quit()
                    except Exception: pass
            
            # Short sleep between launches
            time.sleep(2)

    except Exception as e:
        print(f"❌ 전체 로직 에러: {e}")
    
    finally:
        # Release Lock
        if CRAWLER_LOCK.locked():
            CRAWLER_LOCK.release()
            
    return results

def get_onchain_metrics():
    """모든 온체인 지표 수집 (캐시 없이 즉시 실행)"""
    print("🔄 Fetching new on-chain data...")
    
    # 1. MacroMicro (Scraping)
    results = scrape_macromicro_indicators()
    
    # 2. Funding Rate (Binance)
    try:
        binance_url = "https://fapi.binance.com/fapi/v1/fundingRate"
        binance_params = {"symbol": "BTCUSDT", "limit": 1}
        binance_response = requests.get(binance_url, params=binance_params, timeout=5)
        if binance_response.status_code == 200:
            bd = binance_response.json()
            if bd:
                results["funding_rate"] = float(bd[0].get("fundingRate", 0)) * 100 # %로 변환
    except Exception as e:
        print(f"Binance Error: {e}")

    return results

# --- [3] Main Execution & GitHub Sync ---

def save_and_push_to_github():
    print("\n" + "="*50)
    print(f"🚀 Bitcoin Dashboard Auto-Updater Started at {datetime.now()}")
    print("="*50 + "\n")
    
    # 1. 데이터 수집
    print("Step 1: Market Data Calculation...")
    market = get_market_basics()
    
    print("Step 2: Fear & Greed Index...")
    sentiment = get_fear_greed()
    
    print("Step 3: On-Chain Metrics (This may take a minute)...")
    onchain = get_onchain_metrics()
    
    final_data = {
        "timestamp": datetime.now().isoformat(),
        "market": market,
        "sentiment": sentiment,
        "onchain": onchain
    }
    
    # 2. JSON 파일로 저장
    # GitHub Raw로 접근하기 좋게 프로젝트 루트 혹은 Frontend/public에 저장하면 됨.
    # 여기서는 현재 디렉토리에 저장한다고 가정 (Git Root)
    file_path = DATA_FILE
    
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(final_data, f, ensure_ascii=False, indent=4)
        print(f"\n✅ Data saved to {file_path}")
    except Exception as e:
        print(f"❌ Failed to save JSON: {e}")
        return

    # 3. Git 자동 업로드
    try:
        print("\n☁️ Pushing to GitHub...")
        
        # Git 명령 실행 함수
        def run_git(args):
            result = subprocess.run(["git"] + args, capture_output=True, text=True, check=False)
            if result.returncode != 0:
                print(f"⚠️ Git Warning/Error ({args[0]}): {result.stderr.strip()}")
            return result

        run_git(["add", file_path])
        
        # 변경사항이 있을 때만 커밋
        status = run_git(["status", "--porcelain"])
        if status.stdout.strip():
            commit_msg = f"Auto-update: {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            run_git(["commit", "-m", commit_msg])
            run_git(["push"])
            print("🎉 Success! Data pushed to GitHub.")
            print("   (Data will be available on raw.githubusercontent.com in a few minutes)")
        else:
            print("ℹ️ No changes to commit (Data is same).")
            
    except Exception as e:
        print(f"❌ Git Push Failed: {e}")
        print("   -> Please check your internet connection or Git credentials.")

if __name__ == "__main__":
    save_and_push_to_github()
    print("\n✅ Task Completed. Closing in 5 seconds...")
    time.sleep(5)
