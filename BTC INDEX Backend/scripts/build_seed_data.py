import os
import json
import pandas as pd
import yfinance as yf
import numpy as np

def build_seed():
    print("🚀 Starting 1-Time Seed Data Generation...")
    
    # Paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(script_dir)
    project_root = os.path.dirname(backend_dir)
    mvrv_path = os.path.join(project_root, 'mvrv.csv')
    frontend_data_path = os.path.join(project_root, 'BTC INDEX Frontend_NEW', 'src', 'data', 'historicalData.json')
    
    # 1. Load MVRV Data
    print("📥 Loading MVRV CSV...")
    df_mvrv = pd.read_csv(mvrv_path)
    df_mvrv['d'] = pd.to_datetime(df_mvrv['d']).dt.tz_localize(None)
    df_mvrv = df_mvrv.dropna(subset=['mvrv']).copy()
    
    # 2. Fetch BTC Price
    print("📈 Fetching BTC Price from Yahoo Finance...")
    btc = yf.Ticker('BTC-USD')
    hist = btc.history(period='max')
    hist = hist.reset_index()
    hist['Date'] = pd.to_datetime(hist['Date']).dt.tz_localize(None)
    hist['Price'] = hist['Close']
    
    # 200W MA = 1400 Daily SMA
    hist['SMA_1400'] = hist['Price'].rolling(window=1400, min_periods=1).mean()
    hist['MA_Ratio'] = hist['Price'] / hist['SMA_1400']
    
    # 3. Merge
    print("🔗 Merging and Calculating Z-Score...")
    df = pd.merge(df_mvrv, hist[['Date', 'Price', 'MA_Ratio']], left_on='d', right_on='Date', how='inner')
    df = df.sort_values('d').reset_index(drop=True)
    
    # 4. Proxy Z-Score Math
    df['Realized_Price'] = df['Price'] / df['mvrv']
    
    def get_supply(date_val):
        days = (date_val - pd.to_datetime('2009-01-03')).days
        blocks = days * 144
        supply = 0
        reward = 50
        blocks_left = blocks
        for epoch in range(4):
            if blocks_left > 210000:
                supply += 210000 * reward
                blocks_left -= 210000
                reward /= 2
            else:
                supply += blocks_left * reward
                break
        return supply
        
    df['Approx_Supply'] = df['d'].apply(get_supply)
    df['Market_Cap'] = df['Price'] * df['Approx_Supply']
    df['Realized_Cap'] = df['Realized_Price'] * df['Approx_Supply']
    df['MC_StdDev'] = df['Market_Cap'].expanding().std().replace(0, np.nan)
    
    df['Proxy_Z_Score_MC'] = (df['Market_Cap'] - df['Realized_Cap']) / df['MC_StdDev']
    df['Proxy_Z_Score_MC'] = df['Proxy_Z_Score_MC'].fillna(0)
    
    # 5. 60-day Slope (Current Z - Z 60 days ago)
    df['Slope_60d'] = df['Proxy_Z_Score_MC'] - df['Proxy_Z_Score_MC'].shift(60)
    df['Slope_60d'] = df['Slope_60d'].fillna(0)
    
    # 6. Resample to Weekly
    print("🗓 Resampling to Weekly Data...")
    df.set_index('d', inplace=True)
    weekly = df.resample('W-SUN').last().dropna(subset=['Price'])
    weekly = weekly.reset_index()
    
    # 7. Format JSON
    output = []
    for _, row in weekly.iterrows():
        if row['d'].year >= 2012: # Skip messy early startup days
            output.append({
                "d": row['d'].strftime('%Y-%m-%d'),
                "p": round(float(row['Price']), 2),
                "z": round(float(row['Proxy_Z_Score_MC']), 3),
                "ma": round(float(row['MA_Ratio']), 3),
                "s": round(float(row['Slope_60d']), 3)
            })
            
    # Save
    with open(frontend_data_path, 'w') as f:
        json.dump(output, f, indent=2)
        
    print(f"🎉 Success! Overwritten historicalData.json with {len(output)} real factual points.")

if __name__ == '__main__':
    build_seed()
