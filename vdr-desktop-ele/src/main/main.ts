// main.ts
import { app, BrowserWindow, ipcMain, Tray, Menu } from "electron";
import * as path from "path";
import * as fs from "fs/promises";

const UPLOAD_DIR = path.join(app.getPath("userData"), "uploads");

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

// Helper function to get the correct asset path
function getAssetPath(asset: string): string {
  return isDev()
    ? path.join(__dirname, "../../src/assets", asset)
    : path.join(process.resourcesPath, "assets", asset);
}

function isDev() {
  return process.env.NODE_ENV === "development";
}

const createWindow = () => {
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

// File operation handlers
ipcMain.handle(
  "upload-file",
  async (_event, filename: string, content: Buffer) => {
    try {
      await ensureUploadDir();
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
