from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import List
import pandas as pd
import io
import math
import httpx
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


# ── Allowed tables for batch upload ──────────────────────────────────────────
ALLOWED_TABLES = ["courses", "programs", "program_courses", "term_metrics", "course_so_mappings"]

@app.get("/api/upload/tables")
def get_upload_tables():
    """Return the list of tables the instructor is allowed to bulk-insert into."""
    return {"tables": ALLOWED_TABLES}

@app.get("/api/upload/tables/{table_name}/columns")
async def get_table_columns(table_name: str):
    """
    Fetch the column names (headings) of a Supabase table so the instructor
    knows what columns the Excel sheet should contain.
    """
    if table_name not in ALLOWED_TABLES:
        raise HTTPException(status_code=400, detail=f"Table '{table_name}' is not allowed.")
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured.")

    try:
        # Fetch 1 row to discover column names from the response keys
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{url}/rest/v1/{table_name}?limit=1",
                headers={
                    "apikey": key,
                    "Authorization": f"Bearer {key}",
                    "Accept": "application/json",
                },
            )

        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)

        data = resp.json()
        if data and len(data) > 0:
            columns = list(data[0].keys())
        else:
            # Fallback: use PostgREST OpenAPI definitions
            async with httpx.AsyncClient() as client:
                oa_resp = await client.get(
                    f"{url}/rest/v1/",
                    headers={"apikey": key, "Authorization": f"Bearer {key}"},
                )
            if oa_resp.status_code == 200:
                oa_data = oa_resp.json()
                definitions = oa_data.get("definitions", {})
                table_def = definitions.get(table_name, {})
                columns = list(table_def.get("properties", {}).keys())
            else:
                columns = []

        return {"table": table_name, "columns": columns}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/upload/insert")
async def upload_excel_to_table(
    file: UploadFile = File(...),
    table_name: str = Form(...)
):
    """
    Upload an Excel file and insert its rows into the selected Supabase table.
    The Excel column headers must match the table column names.
    The 'id' and 'created_at' columns are auto-generated and will be stripped.
    """
    if table_name not in ALLOWED_TABLES:
        raise HTTPException(status_code=400, detail=f"Table '{table_name}' is not allowed.")
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured.")
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="File must be .xlsx, .xls, or .csv")

    try:
        contents = await file.read()
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))

        if df.empty:
            raise HTTPException(status_code=400, detail="The uploaded Excel file is empty.")

        # Remove auto-generated columns the user should not supply
        for col in ['id', 'created_at']:
            if col in df.columns:
                df = df.drop(columns=[col])

        # Replace NaN with None for JSON serialization
        records = df.where(df.notna(), None).to_dict(orient='records')
        clean_records = []
        for row in records:
            clean_row = {}
            for k, v in row.items():
                if isinstance(v, float) and math.isnan(v):
                    clean_row[k] = None
                else:
                    clean_row[k] = v
            clean_records.append(clean_row)

        # Batch insert (Supabase limit is ~1000 rows per request)
        inserted = 0
        for i in range(0, len(clean_records), 500):
            batch = clean_records[i:i+500]
            res = supabase.table(table_name).insert(batch).execute()
            inserted += len(res.data)

        return {
            "status": "success",
            "message": f"Inserted {inserted} rows into '{table_name}' from {file.filename}.",
            "inserted_count": inserted,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


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
