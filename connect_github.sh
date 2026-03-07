#!/bin/bash
gh auth login -w
gh repo create "BTC-Dashboard-V2" --public --description "Premium BTC Onchain Dashboard" --source=. --remote=origin --push
