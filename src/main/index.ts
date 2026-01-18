// ABOUTME: Electron main process entry point
// ABOUTME: Creates window and handles IPC for generation

import { app, BrowserWindow, ipcMain, shell, IpcMainInvokeEvent } from "electron";
import { electronApp, is, optimizer } from "@electron-toolkit/utils";
import { join } from "path";

import {
	isSdCppInstalled,
	installSdCpp,
	generateImage,
	GenerateImageOptions,
} from "../shared/sd-cpp";
import { getInstalledModels, downloadModel, SD_MODELS } from "../shared/sd-models";

let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
	mainWindow = new BrowserWindow({
		width: 1400,
		height: 900,
		minWidth: 1000,
		minHeight: 700,
		show: false,
		autoHideMenuBar: true,
		titleBarStyle: "hiddenInset",
		trafficLightPosition: { x: 16, y: 16 },
		webPreferences: {
			preload: join(__dirname, "../preload/index.js"),
			sandbox: false, // Required for preload functionality
		},
	});

	mainWindow.on("ready-to-show", () => {
		mainWindow?.show();
	});

	mainWindow.webContents.setWindowOpenHandler((details) => {
		shell.openExternal(details.url);
		return { action: "deny" };
	});

	if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
		mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
	} else {
		mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
	}
};

// IPC Handlers

// Check if sd-cpp is installed
ipcMain.handle("sd:isInstalled", () => isSdCppInstalled());

// Install sd-cpp
ipcMain.handle("sd:install", async () => {
	return new Promise((resolve, reject) => {
		installSdCpp((progress) => {
			mainWindow?.webContents.send("sd:installProgress", progress);
		})
			.then(() => resolve(true))
			.catch(reject);
	});
});

// Get available models
ipcMain.handle("models:list", () => SD_MODELS);

// Get installed models
ipcMain.handle("models:installed", () => getInstalledModels());

// Download a model
ipcMain.handle(
	"models:download",
	async (_event: IpcMainInvokeEvent, modelId: string) => {
		return new Promise((resolve, reject) => {
			downloadModel(modelId, (progress) => {
				mainWindow?.webContents.send("models:downloadProgress", progress);
			})
				.then(resolve)
				.catch(reject);
		});
	},
);

// Generate an image
ipcMain.handle(
	"generate:image",
	async (_event: IpcMainInvokeEvent, options: GenerateImageOptions) => {
		return new Promise((resolve, reject) => {
			generateImage(options, (progress) => {
				mainWindow?.webContents.send("generate:progress", progress);
			})
				.then(resolve)
				.catch(reject);
		});
	},
);

// App lifecycle
app.whenReady().then(() => {
	electronApp.setAppUserModelId("com.forgecraft");

	app.on("browser-window-created", (_event, window) => {
		optimizer.watchWindowShortcuts(window);
	});

	createWindow();

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});
