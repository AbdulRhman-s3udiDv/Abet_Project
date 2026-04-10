import os
import joblib
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier

class AbetRiskPredictor:
    """
    A Swappable Machine Learning Engine for predicting ABET Course Risks.
    This architecture allows future developers to easily replace the model 
    (e.g., swapping to Deep Learning or Random Forest) without rewriting the API.
    """
    def __init__(self, model_path="model_v1.pkl"):
        self.model_path = model_path
        self.version = "1.0.0 (HistGradientBoosting)"
        self.model = None
        self.features = [
            'avg_score', 'pass_rate', 
            'so1_attainment', 'so2_attainment', 'so3_attainment', 
            'so4_attainment', 'so5_attainment', 'so6_attainment', 'so7_attainment',
            'composite_so_index', 'trend_value'
        ]
        self.load_model()

    def load_model(self):
        if os.path.exists(self.model_path):
            self.model = joblib.load(self.model_path)
            print(f"Loaded existing model {self.version} from {self.model_path}")
        else:
            print("Model not found on disk. Initializing a new blank model. Please call retrain() with historical data.")
            self.model = HistGradientBoostingClassifier(
                random_state=42, 
                learning_rate=0.05, 
                max_depth=5, 
                max_iter=300,
                l2_regularization=0.0
            )

    def predict(self, input_data: dict) -> float:
        """
        Takes the 11 raw features and outputs a Risk Probability (0.0 to 100.0)
        """
        # Formulate pandas dataframe to match training structure
        df_input = pd.DataFrame([input_data])[self.features]
        # output is probabilty for class 1 (Risk)
        risk_probability = self.model.predict_proba(df_input)[0][1]
        return round(risk_probability * 100, 2)

    def retrain(self, df_historical: pd.DataFrame):
        """
        Allows the system to retrain the swappable model on fresh data.
        df_historical must contain the self.features + 'next_term_risk' target label.
        """
        X = df_historical[self.features]
        y = df_historical['next_term_risk']
        self.model.fit(X, y)
        joblib.dump(self.model, self.model_path)
        print(f"Model retrained and saved to {self.model_path}")
