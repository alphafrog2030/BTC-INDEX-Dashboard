from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os
import time

import bitcoin_onchain_backend as backend_module

app = FastAPI(title="BTC Onchain Dashboard API", version="1.0.0")

# Setup CORS to allow the frontend to access the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins, change to specific origins in config for production
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

DATA_FILE = "data.json"

@app.get("/")
def read_root():
    return {"message": "Welcome to the BTC Onchain API"}

@app.get("/api/data")
def get_dashboard_data():
    """
    Returns the latest BTC onchain data from the local JSON file.
    """
    if not os.path.exists(DATA_FILE):
        raise HTTPException(status_code=404, detail="Data file not found. Please trigger an update first.")
    
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading data: {str(e)}")

def background_update_task():
    """
    Runs the data gathering process in the background.
    """
    print("Starting background data update...")
    try:
        # Instead of pushing to github, we just save locally.
        # We need to modify "save_and_push_to_github" to just save, but we will call it for now.
        # Alternatively, we can just call the core components.
        from datetime import datetime
        
        market = backend_module.get_market_basics()
        sentiment = backend_module.get_fear_greed()
        onchain = backend_module.get_onchain_metrics()
        
        final_data = {
            "timestamp": datetime.now().isoformat(),
            "market": market,
            "sentiment": sentiment,
            "onchain": onchain
        }
        
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(final_data, f, ensure_ascii=False, indent=4)
        print(f"Background data update complete. Saved to {DATA_FILE}")
    except Exception as e:
        print(f"Background update failed: {e}")


@app.post("/api/update")
def trigger_data_update(background_tasks: BackgroundTasks):
    """
    Triggers a manual refresh of the onchain data.
    """
    background_tasks.add_task(background_update_task)
    return {"message": "Data update has been triggered and is running in the background."}
