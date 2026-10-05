import io
import contextlib
import os
import pandas as pd
from langchain_google_genai import ChatGoogleGenerativeAI

class DataPulseEngine:
    def __init__(self, df: pd.DataFrame):
        self.df = df
        self.llm = ChatGoogleGenerativeAI(
            model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            google_api_key=os.getenv("GEMINI_API_KEY"),
            temperature=0,
        )

    def analyze(self, user_query: str, max_retries: int = 3) -> dict:
        columns_info = list(self.df.columns)
        sample_data = self.df.head(3).to_dict(orient="records")
        
        prompt = f"""
You are an automated enterprise data analyst. Given a pandas DataFrame `df`:
Columns: {columns_info}
Sample rows: {sample_data}

User Query: {user_query}

Write valid, executable Python code to answer the query using `df`.
- Assign a clear string explanation to the variable `summary`.
- If a chart/graph makes sense, build a list of dicts assigned to `chart_data` (each dict having key 'label' and 'value').
- Do not output markdown except for the code block (```python ... ```).
"""
        error_log = ""
        for attempt in range(max_retries):
            current_prompt = prompt + (f"\n\nPrevious attempt failed with error:\n{error_log}\nFix the code." if error_log else "")
            response = self.llm.invoke(current_prompt)
            code = self._clean_code(response.content)
            
            local_scope = {"df": self.df, "pd": pd}
            stdout = io.StringIO()
            try:
                with contextlib.redirect_stdout(stdout):
                    exec(code, local_scope)
                
                return {
                    "summary": local_scope.get("summary", stdout.getvalue() or "Analysis complete."),
                    "chart_data": local_scope.get("chart_data", None),
                    "status": "Success",
                    "verification_attempts": attempt + 1
                }
            except Exception as e:
                error_log = str(e)
                
        return {
            "summary": f"Could not process query automatically. Error details: {error_log}",
            "chart_data": None,
            "status": "Failed"
        }

    def _clean_code(self, text: str) -> str:
        if "```python" in text:
            return text.split("```python")[1].split("```")[0].strip()
        elif "```" in text:
            return text.split("```")[1].split("```")[0].strip()
        return text.strip()