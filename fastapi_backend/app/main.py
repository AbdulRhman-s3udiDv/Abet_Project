from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
import pandas as pd
import io
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

from .schemas import CourseMetricsInput, PredictionResponse
from .ml_engine import AbetRiskPredictor

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Smart ABET Accreditation Platform API",
    description="Backend for course risk prediction and evidence generation.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the Swappable ML Engine
# It will load 'model_v1.pkl' if it exists, otherwise it stays blank awaiting training.
predictor = AbetRiskPredictor()

# Setup Supabase client safely
supabase: Client = None
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
if url and key and "your-supabase" not in url:
    supabase = create_client(url, key)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "ABET ML API is running!"}

@app.post("/predict/manual", response_model=PredictionResponse)
def predict_manual_metrics(payload: CourseMetricsInput):
    """
    Predict course risk for the upcoming term based on manual metric entry.
    The payload includes `program_code` (e.g. 'CS', 'AIE') which the frontend 
    uses to display the correct Student Outcomes (SOs) defined for that program.
    """
    input_features = {
        'avg_score': payload.avg_score,
        'pass_rate': payload.pass_rate,
        'so1_attainment': payload.so1_attainment,
        'so2_attainment': payload.so2_attainment,
        'so3_attainment': payload.so3_attainment,
        'so4_attainment': payload.so4_attainment,
        'so5_attainment': payload.so5_attainment,
        'so6_attainment': payload.so6_attainment,
        'so7_attainment': payload.so7_attainment,
        'composite_so_index': payload.composite_so_index,
        'trend_value': payload.trend_value
    }

    try:
        risk_prob = predictor.predict(input_features)
        return PredictionResponse(
            course_code=payload.course_code,
            academic_term=payload.academic_term,
            risk_probability=risk_prob,
            is_at_risk=risk_prob > 50.0,
            model_version=predictor.version
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict/upload-excel")
async def predict_from_excel(file: UploadFile = File(...)):
    """
    Accepts an Excel sheet representing the current semester's raw grades.
    Note: In a real implementation, this endpoint would parse the file, 
    calculate pass_rate, averages, and trend based on previous terms in the DB, 
    and then call the predictor.
    """
    if not file.filename.endswith('.xlsx'):
        raise HTTPException(status_code=400, detail="File must be .xlsx")
        
    contents = await file.read()
    # Mocking extraction logic for demonstration
    # df = pd.read_excel(io.BytesIO(contents))
    
    return {
        "status": "success", 
        "message": f"Parsed {file.filename} successfully. Awaiting calculation pipeline integration."
    }

@app.get("/api/courses")
def get_all_courses():
    if not supabase: return {"courses": []}
    res = supabase.table("courses").select("id, course_code").execute()
    return {"courses": res.data}

@app.get("/api/courses/{course_id}/trend")
def get_course_trend(course_id: int):
    """Returns actual historical metrics connected from Supabase Database."""
    if not supabase: return []
    res = supabase.table("term_metrics").select("academic_term, composite_so_index, pass_rate").eq("course_id", course_id).order("academic_term").execute()
    
    # Map to frontend expected labels
    mapped_data = []
    for row in res.data:
        mapped_data.append({
            "term": row["academic_term"],
            "index": row["composite_so_index"],
            "pass_rate": row["pass_rate"]
        })
    return mapped_data

@app.get("/api/programs")
def get_programs():
    if not supabase: return []
    res = supabase.table("programs").select("*").execute()
    return res.data

@app.get("/api/programs/{program_id}/courses")
def get_program_courses(program_id: int):
    if not supabase: return []
    res = supabase.table("program_courses").select("course_id, courses(id, course_code, course_name)").eq("program_id", program_id).execute()
    coursesList = []
    for r in res.data:
        if r.get("courses"):
            coursesList.append(r["courses"])
    return coursesList

@app.get("/api/courses/{course_id}/terms")
def get_course_terms(course_id: int):
    if not supabase: return []
    res = supabase.table("term_metrics").select("*").eq("course_id", course_id).order("academic_term").execute()
    return res.data
