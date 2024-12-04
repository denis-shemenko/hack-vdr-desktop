from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from typing import Optional, List
from pathlib import Path
import shutil
import os
import json
import logging
import stat

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR: Optional[Path] = "default"

@app.post("/set-config")
async def set_config(config: dict):
    global UPLOAD_DIR
    try:
        logger.info(f"Received config: {config}")
        
        if "config_path" not in config:
            raise ValueError("config_path not provided")
            
        config_path = config["config_path"]
        logger.info(f"Config path: {config_path}")
        
        if not os.path.exists(config_path):
            raise FileNotFoundError(f"Config file not found at {config_path}")
            
        with open(config_path) as f:
            config_data = json.load(f)
            logger.info(f"Loaded config data: {config_data}")
            
            if "upload_dir" not in config_data:
                raise ValueError("upload_dir not found in config file")
                
            UPLOAD_DIR = Path(config_data["upload_dir"])
            UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
            
            # Set directory permissions to 755 (rwxr-xr-x)
            os.chmod(UPLOAD_DIR, stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IXOTH)
            
            logger.info(f"Set UPLOAD_DIR to {UPLOAD_DIR} with full permissions")
            
        return {"status": "success", "upload_dir": str(UPLOAD_DIR)}
    except Exception as e:
        logger.error(f"Error setting config: {str(e)}", exc_info=True)
        return {"error": str(e)}

@app.get("/config")
async def get_config():
    """Endpoint to check current configuration"""
    return {
        "upload_dir": str(UPLOAD_DIR) if UPLOAD_DIR else None,
        "upload_dir_exists": UPLOAD_DIR.exists() if UPLOAD_DIR else False if UPLOAD_DIR else None
    }

# Add validation to other endpoints
def validate_upload_dir():
    if UPLOAD_DIR is None:
        return {"error": "Upload directory not configured"}
    if not UPLOAD_DIR.exists():
        return {"error": "Upload directory does not exist"}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        # Use the filename from the uploaded file
        filename = file.filename.replace('\\', '/')
        
        # Create full path in upload directory
        full_path = UPLOAD_DIR / filename
        
        # Ensure parent directory exists
        os.makedirs(str(full_path.parent), exist_ok=True)
        
        # Save the file
        with open(full_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        return {
            "filename": filename,
            "status": "success"
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/upload-folder")
async def upload_folder(files: List[UploadFile] = File(...), path: str = Form("")):
    validate_upload_dir()
    try:
        results = []
        for file in files:
            # Create full path including any subdirectories
            full_path = UPLOAD_DIR / path / file.filename
            
            # Ensure the directory structure exists
            full_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Save the file
            with open(full_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            results.append({
                "filename": file.filename,
                "path": str(full_path.relative_to(UPLOAD_DIR)),
                "status": "success"
            })
        
        return {"files": results}
    except Exception as e:
        return {"error": str(e)}

@app.get("/download/{file_path:path}")
async def download_file(file_path: str):
    full_path = UPLOAD_DIR / file_path
    if full_path.exists():
        return FileResponse(full_path)
    return {"error": "File not found"}

@app.delete("/delete/{file_path:path}")
async def delete_file(file_path: str):
    full_path = UPLOAD_DIR / file_path
    try:
        if full_path.is_file():
            os.remove(full_path)
            # Remove empty parent directories
            current_dir = full_path.parent
            while current_dir != UPLOAD_DIR:
                if not any(current_dir.iterdir()):
                    current_dir.rmdir()
                    current_dir = current_dir.parent
                else:
                    break
            return {"status": "success", "message": f"{file_path} deleted"}
        return {"error": "File not found"}
    except Exception as e:
        return {"error": str(e)}

@app.get("/files")
async def list_files(path: str = ""):
    validate_upload_dir()
    try:
        current_dir = UPLOAD_DIR / path
        logger.info(f"Listing files in directory: {current_dir}")
        
        entries = []
        if current_dir.exists():
            for entry in current_dir.iterdir():
                relative_entry = entry.relative_to(UPLOAD_DIR / path)
                if entry.is_dir():
                    entries.append(f"{str(relative_entry)}/")
                else:
                    entries.append(str(relative_entry))
                    
        logger.info(f"Found entries: {entries}")
        return {"entries": sorted(entries, key=lambda x: (not x.endswith('/'), x.lower()))}
    except Exception as e:
        logger.error(f"Error listing files: {str(e)}", exc_info=True)
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)