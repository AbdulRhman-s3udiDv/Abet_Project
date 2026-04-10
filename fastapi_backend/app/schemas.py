from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime

class CourseMetricsInput(BaseModel):
    course_code: str = Field(..., description="The ID of the course, e.g., AIE111")
    program_code: str = Field(..., description="The ID of the Program (CS, AIS, AIE, CE)")
    academic_term: str = Field(..., description="The term string, e.g., 2024S")
    avg_score: float = Field(..., description="Average student score")
    pass_rate: float = Field(..., description="Percentage of students passing")
    
    # SOs can be None if the program/course does not map to them
    so1_attainment: Optional[float] = None
    so2_attainment: Optional[float] = None
    so3_attainment: Optional[float] = None
    so4_attainment: Optional[float] = None
    so5_attainment: Optional[float] = None
    so6_attainment: Optional[float] = None
    so7_attainment: Optional[float] = None
    
    composite_so_index: float = Field(..., description="Aggregated SO mapping score")
    trend_value: float = Field(..., description="Trend relative to previous term")

class PredictionResponse(BaseModel):
    course_code: str
    academic_term: str
    risk_probability: float = Field(..., description="Risk probability percentage (0 to 100)")
    is_at_risk: bool = Field(..., description="True if risk_probability > 50%")
    model_version: str

class TrendDataResponse(BaseModel):
    course_code: str
    history: List[Dict[str, float]] # List of { term: "2023F", composite_so: 75.0, pass_rate: 80.0 }
