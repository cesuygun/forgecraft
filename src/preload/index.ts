// ABOUTME: Preload script - exposes safe APIs to renderer
// ABOUTME: Bridges main process capabilities to the UI

import { contextBridge, ipcRenderer } from "electron";

// Re-export types from shared for consistency (single source of truth)
import type {
	InstallProgress,
	GenerationProgress,
	GenerateImageOptions,
	GenerateImageResult,
} from "../shared/sd-cpp";
import type { SdModel, DownloadProgress } from "../shared/sd-models";

// Re-export for consumers
export type {
	InstallProgress,
	GenerationProgress,
	GenerateImageOptions,
	GenerateImageResult,
	SdModel,
	DownloadProgress,
};

// API exposed to renderer
const forgeApi = {
	// SD binary management
	sd: {
		isInstalled: (): Promise<boolean> => ipcRenderer.invoke("sd:isInstalled"),
		install: (): Promise<boolean> => ipcRenderer.invoke("sd:install"),
		onInstallProgress: (callback: (progress: InstallProgress) => void) => {
			const handler = (_: unknown, progress: InstallProgress) =>
				callback(progress);
			ipcRenderer.on("sd:installProgress", handler);
			return () => ipcRenderer.removeListener("sd:installProgress", handler);
		},
	},

	// Model management
	models: {
		list: (): Promise<SdModel[]> => ipcRenderer.invoke("models:list"),
		installed: (): Promise<SdModel[]> => ipcRenderer.invoke("models:installed"),
		download: (modelId: string): Promise<string> =>
			ipcRenderer.invoke("models:download", modelId),
		onDownloadProgress: (callback: (progress: DownloadProgress) => void) => {
			const handler = (_: unknown, progress: DownloadProgress) =>
				callback(progress);
			ipcRenderer.on("models:downloadProgress", handler);
			return () =>
				ipcRenderer.removeListener("models:downloadProgress", handler);
		},
	},

	// Image generation
	generate: {
		image: (options: GenerateImageOptions): Promise<GenerateImageResult> =>
			ipcRenderer.invoke("generate:image", options),
		onProgress: (callback: (progress: GenerationProgress) => void) => {
			const handler = (_: unknown, progress: GenerationProgress) =>
				callback(progress);
			ipcRenderer.on("generate:progress", handler);
			return () => ipcRenderer.removeListener("generate:progress", handler);
		},
	},
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld("forge", forgeApi);

// Type declaration for the renderer
export type ForgeApi = typeof forgeApi;
