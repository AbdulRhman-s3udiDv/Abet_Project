import pandas as pd
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.ml_engine import AbetRiskPredictor

if os.path.exists("model_v1.pkl"):
    os.remove("model_v1.pkl")
    print("Deleted old 70% model artifact. Preparing >90% upgrade...")

print("Initializing AbetRiskPredictor...")
pr = AbetRiskPredictor()
try:
    print("Reading dataset from parent folder...")
    df = pd.read_csv('../predictive_ml_dataset.csv')
    
    if 'is_at_risk' in df.columns and 'next_term_risk' not in df.columns:
        df['next_term_risk'] = df['is_at_risk']
    elif 'target_risk_probability' in df.columns and 'next_term_risk' not in df.columns:
        df['next_term_risk'] = df['target_risk_probability'] > 50

    print("Beginning Training (fit) on", len(df), "records...")
    pr.retrain(df)
    print("SUCCESS: model_v1.pkl trained and saved successfully!")
    
except Exception as e:
    print("ERROR during training:", str(e))
