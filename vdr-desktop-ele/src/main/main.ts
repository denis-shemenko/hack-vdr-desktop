// main.ts
import { app, BrowserWindow, ipcMain, Tray, Menu, dialog } from "electron";
import * as path from "path";
import * as fs from "fs/promises";
import chokidar, { FSWatcher } from "chokidar";

const UPLOAD_DIR = path.join(app.getPath("userData"), "uploads");

// Add configuration endpoint
async function setupFastAPIConfig() {
  try {
    // Create config file for FastAPI
    const configPath = path.join(app.getPath("userData"), "config.json");
    const config = {
      upload_dir: UPLOAD_DIR,
    };

    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    console.log("Config file created at:", configPath);

    // Notify FastAPI about the config location
    try {
      const response = await fetch("http://127.0.0.1:8000/set-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ config_path: configPath }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      console.log("FastAPI config updated successfully");
    } catch (error) {
      console.error("Failed to notify FastAPI:", error);
      // Don't throw here - we want the app to start even if FastAPI isn't running
    }
  } catch (error) {
    console.error("Error setting up config:", error);
  }
}

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let watcher: FSWatcher | null = null;

// Helper function to get the correct asset path
function getAssetPath(asset: string): string {
  return isDev()
    ? path.join(__dirname, "../../src/assets", asset)
    : path.join(process.resourcesPath, "assets", asset);
}

function isDev() {
  return process.env.NODE_ENV === "development";
}

// Consolidated file watching setup
function setupFileWatcher() {
  if (watcher) {
    watcher.close();
  }

  watcher = chokidar.watch(UPLOAD_DIR, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: false, // Changed to true to catch initial files
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100,
    },
  });

  watcher
    .on("add", (path) => {
      console.log(`File ${path} has been added`);
      mainWindow?.webContents.send("files-changed");
    })
    .on("unlink", (path) => {
      console.log(`File ${path} has been removed`);
      mainWindow?.webContents.send("files-changed");
    })
    .on("change", (path) => {
      console.log(`File ${path} has been changed`);
      mainWindow?.webContents.send("files-changed");
    })
    .on("error", (error) => {
      console.error(`Watcher error: ${error}`);
    });

  return watcher;
}

const createWindow = async () => {
  await ensureUploadDir();
  await setupFastAPIConfig();

  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, "../preload/preload.js"),
    },
    icon: getAssetPath("app-icon-yody.png"),
  });

  // Load the appropriate URL
  if (isDev()) {
    // Development - load from Vite dev server
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    // Production - load from built files
    mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  mainWindow.on("close", (event) => {
    event.preventDefault();
    mainWindow?.hide();
  });

  setupFileWatcher();
};

const createTray = () => {
  tray = new Tray(getAssetPath("app-icon.png"));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show",
      click: () => mainWindow?.show(),
    },
    {
      label: "Hide",
      click: () => mainWindow?.hide(),
    },
    {
      type: "separator",
    },
    {
      label: "Quit",
      click: () => {
        mainWindow?.destroy();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip("VDR Desktop App");

  tray.on("click", () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
    }
  });
};

// Add a handler to get upload directory
ipcMain.handle("get-upload-dir", () => UPLOAD_DIR);

// File operation handlers
ipcMain.handle(
  "upload-file",
  async (_event, filename: string, content: Buffer) => {
    try {
      const filePath = path.join(UPLOAD_DIR, filename);
      await fs.writeFile(filePath, content);
      return { success: true, filePath };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
);

ipcMain.handle("download-file", async (_event, filename: string) => {
  try {
    const filePath = path.join(UPLOAD_DIR, filename);
    const content = await fs.readFile(filePath);
    return { success: true, content };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle("delete-file", async (_event, _filename: string) => {
  try {
    // We don't need to actually delete the file here since FastAPI handles it
    // Just return success to update the UI
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle("upload-folder", async (_event, folderPath: string) => {
  try {
    const getFiles = async (dir: string): Promise<string[]> => {
      const dirents = await fs.readdir(dir, { withFileTypes: true });
      const files = await Promise.all(
        dirents.map((dirent) => {
          const res = path.join(dir, dirent.name);
          return dirent.isDirectory() ? getFiles(res) : [res];
        })
      );
      return files.flat();
    };

    const files = await getFiles(folderPath);
    return { success: true, files };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// Also add a helper to read file content
ipcMain.handle("read-file-content", async (_event, filePath: string) => {
  try {
    const content = await fs.readFile(filePath);
    return { success: true, content };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle("open-folder-dialog", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  return result.filePaths[0];
});

// Update preload API
ipcMain.handle("watch-files", async () => {
  // If watcher isn't running for some reason, set it up
  if (!watcher && mainWindow) {
    setupFileWatcher();
  }
  return { success: true };
});

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
});
