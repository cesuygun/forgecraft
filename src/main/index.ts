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
import { initDatabase, closeDatabase } from "./db";
import {
	listThemes,
	getTheme,
	createTheme,
	updateTheme,
	deleteTheme,
	listTemplates,
	getTemplate,
	createTemplate,
	updateTemplate,
	deleteTemplate,
} from "./data";
import type { CreateThemeInput, UpdateThemeInput, CreateTemplateInput, UpdateTemplateInput } from "./data";

// Type guards for IPC input validation
const assertString = (value: unknown, name: string): string => {
	if (typeof value !== "string") {
		throw new Error(`Invalid ${name}: expected string`);
	}
	return value;
};

const assertObject = <T>(value: unknown, name: string): T => {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new Error(`Invalid ${name}: expected object`);
	}
	return value as T;
};

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

// ============================================================================
// Theme IPC Handlers
// ============================================================================

ipcMain.handle("themes:list", () => listThemes());
ipcMain.handle("themes:get", (_event: IpcMainInvokeEvent, id: unknown) =>
	getTheme(assertString(id, "theme ID")),
);
ipcMain.handle("themes:create", (_event: IpcMainInvokeEvent, input: unknown) =>
	createTheme(assertObject<CreateThemeInput>(input, "theme input")),
);
ipcMain.handle("themes:update", (_event: IpcMainInvokeEvent, id: unknown, input: unknown) =>
	updateTheme(assertString(id, "theme ID"), assertObject<UpdateThemeInput>(input, "theme input")),
);
ipcMain.handle("themes:delete", (_event: IpcMainInvokeEvent, id: unknown) =>
	deleteTheme(assertString(id, "theme ID")),
);

// ============================================================================
// Template IPC Handlers
// ============================================================================

ipcMain.handle("templates:list", () => listTemplates());
ipcMain.handle("templates:get", (_event: IpcMainInvokeEvent, id: unknown) =>
	getTemplate(assertString(id, "template ID")),
);
ipcMain.handle("templates:create", (_event: IpcMainInvokeEvent, input: unknown) =>
	createTemplate(assertObject<CreateTemplateInput>(input, "template input")),
);
ipcMain.handle("templates:update", (_event: IpcMainInvokeEvent, id: unknown, input: unknown) =>
	updateTemplate(
		assertString(id, "template ID"),
		assertObject<UpdateTemplateInput>(input, "template input"),
	),
);
ipcMain.handle("templates:delete", (_event: IpcMainInvokeEvent, id: unknown) =>
	deleteTemplate(assertString(id, "template ID")),
);

// ============================================================================
// App lifecycle
// ============================================================================

app.whenReady().then(() => {
	// Initialize database
	initDatabase();

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

app.on("quit", () => {
	closeDatabase();
});
