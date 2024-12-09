import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  uploadFile: (filename: string, content: Buffer) =>
    ipcRenderer.invoke("upload-file", filename, content),
  downloadFile: (filename: string) =>
    ipcRenderer.invoke("download-file", filename),
  deleteFile: (filename: string) => ipcRenderer.invoke("delete-file", filename),
  uploadFolder: (folderPath: string) =>
    ipcRenderer.invoke("upload-folder", folderPath),
  readFileContent: (filePath: string) =>
    ipcRenderer.invoke("read-file-content", filePath),
  openFolderDialog: () => ipcRenderer.invoke("open-folder-dialog"),
  watchFiles: () => ipcRenderer.invoke("watch-files"),
  getUploadDir: () => ipcRenderer.invoke("get-upload-dir"),
  searchDocuments: (query: string) =>
    ipcRenderer.invoke("search-documents", query),
  onFilesChanged: (callback: () => void) => {
    const subscription = (_event: any) => callback();
    ipcRenderer.on("files-changed", subscription);
    return () => {
      ipcRenderer.removeListener("files-changed", subscription);
    };
  },
});
