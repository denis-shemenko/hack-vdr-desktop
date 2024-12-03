import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  uploadFile: (filename: string, content: Buffer) =>
    ipcRenderer.invoke("upload-file", filename, content),
  downloadFile: (filename: string) =>
    ipcRenderer.invoke("download-file", filename),
  deleteFile: (filename: string) => ipcRenderer.invoke("delete-file", filename),
});
