# VDR Desktop Application

A desktop application built with Electron, React, and FastAPI backend for managing file uploads and downloads.

## Prerequisites

- Node.js (v16 or higher)
- Python (v3.8 or higher)
- pip (Python package manager)
- yarn or npm

## Project Structure

```
vdr-desktop/
├── src/                    # Frontend React code
├── electron/               # Electron main process code
├── backend/                # FastAPI backend code
└── package.json           # Node.js dependencies
```

## Setup Instructions

### 1. Backend Setup (FastAPI)

1. Create and activate a virtual environment:

   ```bash
   python -m venv venv
   # On Windows
   .\venv\Scripts\activate
   # On macOS/Linux
   source venv/bin/activate
   ```

2. Install Python dependencies:

   ```bash
   pip install fastapi uvicorn python-multipart
   ```

3. Start the FastAPI server:
   ```bash
   # Navigate to the backend directory
   cd backend
   # Start the server
   uvicorn main:app --reload --port 8000
   ```

### 2. Frontend Setup (Electron + React)

1. Install Node.js dependencies:

   ```bash
   # Using yarn
   yarn install
   # Or using npm
   npm install
   ```

2. Install required dependencies:

   ```bash
   # Using yarn
   yarn add electron electron-builder @types/electron buffer chokidar lucide-react
   yarn add -D @types/node typescript

   # Or using npm
   npm install electron electron-builder @types/electron buffer chokidar lucide-react
   npm install --save-dev @types/node typescript
   ```

3. Start the development server:
   ```bash
   # Using yarn
   yarn dev
   # Or using npm
   npm run dev
   ```

## Development

The application uses:

- Electron for the desktop application wrapper
- React with TypeScript for the frontend UI
- FastAPI for the backend server
- Tailwind CSS for styling

### Key Features

- File upload and download functionality
- Folder upload support
- Real-time file system monitoring
- System tray integration
- Cross-platform support (Windows, macOS, Linux)

### API Endpoints

The FastAPI backend provides the following endpoints:

- `POST /upload` - Upload a single file
- `POST /upload-folder` - Upload multiple files preserving folder structure
- `GET /download/{filename}` - Download a file
- `DELETE /delete/{filename}` - Delete a file
- `GET /files` - List all files
- `POST /set-config` - Set application configuration

## Building for Production

1. Build the React frontend:

   ```bash
   # Using yarn
   yarn build
   # Or using npm
   npm run build
   ```

2. Package the Electron application:
   ```bash
   # Using yarn
   yarn electron:build
   # Or using npm
   npm run electron:build
   ```

The packaged application will be available in the `dist` directory.

## Notes

- The application creates an uploads directory in the user's app data folder
- File watching is implemented using chokidar
- The backend server must be running for the application to function properly
- All file operations are synchronized between the frontend and backend

## Troubleshooting

1. If you get CORS errors, ensure the FastAPI backend is running and the CORS middleware is properly configured
2. If files aren't showing up, check the upload directory permissions
3. For backend connection issues, verify the FastAPI server is running on port 8000
