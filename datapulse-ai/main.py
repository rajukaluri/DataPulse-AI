import io
import os
import zipfile
import numpy as np
import pandas as pd
from agent_engine import DataPulseEngine
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from google.api_core.exceptions import ResourceExhausted
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="DataPulse AI Backend")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session store for uploaded datasets
session_store = {}


class AnalysisRequest(BaseModel):
    query: str


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    filename = file.filename or ""
    extension = os.path.splitext(filename)[1].lower()
    if extension not in (".csv", ".xlsx"):
        raise HTTPException(
            status_code=400, detail="Only .csv and .xlsx files are supported."
        )

    contents = await file.read()
    try:
        if extension == ".csv":
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
    except (
        pd.errors.ParserError,
        UnicodeDecodeError,
        ValueError,
        zipfile.BadZipFile,
    ) as exc:
        raise HTTPException(
            status_code=400, detail=f"Could not read the uploaded file: {exc}"
        ) from exc

    session_store["active_df"] = df
    session_store["filename"] = filename

    # Clean preview: replace Inf/-Inf with NaN, then convert all NaN to None (JSON null)
    clean_preview_df = df.head(5).replace([np.inf, -np.inf], np.nan).astype(object)
    clean_preview_df = clean_preview_df.where(pd.notnull(clean_preview_df), None)

    return {
        "status": "success",
        "filename": filename,
        "total_rows": len(df),
        "columns": list(df.columns),
        "preview": clean_preview_df.to_dict(orient="records"),
    }


@app.post("/api/analyze")
async def analyze(payload: AnalysisRequest):
    if "active_df" not in session_store:
        raise HTTPException(
            status_code=400, detail="No active dataset uploaded."
        )
    if not os.getenv("GEMINI_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail=(
                "Gemini is not configured. Add GEMINI_API_KEY to "
                "datapulse-ai/.env and restart the backend."
            ),
        )

    engine = DataPulseEngine(session_store["active_df"])
    try:
        result = engine.analyze(payload.query)
    except ResourceExhausted as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "The Gemini API quota or rate limit has been reached. Check "
                "the Google AI Studio project and try again."
            ),
        ) from exc
    return result


@app.get("/api/health")
def health():
    return {"status": "online", "dataset_loaded": "active_df" in session_store}