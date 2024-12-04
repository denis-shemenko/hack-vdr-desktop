from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from typing import Optional
from pathlib import Path
import shutil
import os
import json

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variable to store upload directory
UPLOAD_DIR: Optional[Path] = None

# Create uploads directory
# UPLOAD_DIR = "uploads"
# os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/set-config")
async def set_config(config: dict):
    global UPLOAD_DIR
    try:
        with open(config["config_path"]) as f:
            config_data = json.load(f)
            UPLOAD_DIR = Path(config_data["upload_dir"])
            # Ensure directory exists
            UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        return {"status": "success", "upload_dir": str(UPLOAD_DIR)}
    except Exception as e:
        return {"error": str(e)}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"filename": file.filename, "status": "success"}
    except Exception as e:
        return {"error": str(e)}

@app.get("/download/{filename}")
async def download_file(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(file_path):
        return FileResponse(file_path)
    return {"error": "File not found"}

@app.delete("/delete/{filename}")
async def delete_file(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    try:
        os.remove(file_path)
        return {"status": "success", "message": f"{filename} deleted"}
    except Exception as e:
        return {"error": str(e)}

@app.get("/files")
async def list_files():
    try:
        files = os.listdir(UPLOAD_DIR)
        return {"files": files}
    except Exception as e:
        return {"error": str(e)}

@app.post("/upload-folder")
async def upload_folder(files: list[UploadFile]):
    try:
        results = []
        for file in files:
            # Extract relative path from filename
            relative_path = file.filename.replace('\\', '/')
            full_path = os.path.join(UPLOAD_DIR, relative_path)
            
            # Create directory structure if needed
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            
            # Save the file
            with open(full_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            results.append({"filename": relative_path, "status": "success"})
        
        return {"files": results}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)