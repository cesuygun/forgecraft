// ABOUTME: Electron main process entry point
// ABOUTME: Creates window and handles IPC for generation

import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  IpcMainInvokeEvent,
  protocol,
  net,
} from "electron";
import { electronApp, is, optimizer } from "@electron-toolkit/utils";
import { join } from "path";

import {
  isSdCppInstalled,
  installSdCpp,
  generateImage,
  GenerateImageOptions,
} from "../shared/sd-cpp";
import {
  getInstalledModels,
  downloadModel,
  SD_MODELS,
} from "../shared/sd-models";
import {
  initDatabase,
  closeDatabase,
  listGenerations,
  countGenerations,
} from "./db";
import type { ListGenerationsOptions } from "./db";
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
  buildOutputPath,
  getSettings,
  saveSettings,
} from "./data";
import type {
  CreateThemeInput,
  UpdateThemeInput,
  CreateTemplateInput,
  UpdateTemplateInput,
} from "./data";
import {
  createQueueService,
  type QueueService,
} from "./services/queue-service";
import type { GenerationRequest, AppSettings } from "../shared/types";

// Queue service instance (initialized on app ready)
let queueService: QueueService | null = null;

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
ipcMain.handle("themes:create", async (_event: IpcMainInvokeEvent, input: unknown) => {
  const result = createTheme(assertObject<CreateThemeInput>(input, "theme input"));
  mainWindow?.webContents.send("themes:changed");
  return result;
});
ipcMain.handle(
  "themes:update",
  async (_event: IpcMainInvokeEvent, id: unknown, input: unknown) => {
    const result = updateTheme(
      assertString(id, "theme ID"),
      assertObject<UpdateThemeInput>(input, "theme input"),
    );
    mainWindow?.webContents.send("themes:changed");
    return result;
  },
);
ipcMain.handle("themes:delete", async (_event: IpcMainInvokeEvent, id: unknown) => {
  const result = deleteTheme(assertString(id, "theme ID"));
  mainWindow?.webContents.send("themes:changed");
  return result;
});

// ============================================================================
// Template IPC Handlers
// ============================================================================

ipcMain.handle("templates:list", () => listTemplates());
ipcMain.handle("templates:get", (_event: IpcMainInvokeEvent, id: unknown) =>
  getTemplate(assertString(id, "template ID")),
);
ipcMain.handle(
  "templates:create",
  async (_event: IpcMainInvokeEvent, input: unknown) => {
    const result = createTemplate(assertObject<CreateTemplateInput>(input, "template input"));
    mainWindow?.webContents.send("templates:changed");
    return result;
  },
);
ipcMain.handle(
  "templates:update",
  async (_event: IpcMainInvokeEvent, id: unknown, input: unknown) => {
    const result = updateTemplate(
      assertString(id, "template ID"),
      assertObject<UpdateTemplateInput>(input, "template input"),
    );
    mainWindow?.webContents.send("templates:changed");
    return result;
  },
);
ipcMain.handle("templates:delete", async (_event: IpcMainInvokeEvent, id: unknown) => {
  const result = deleteTemplate(assertString(id, "template ID"));
  mainWindow?.webContents.send("templates:changed");
  return result;
});

// ============================================================================
// Queue IPC Handlers
// ============================================================================

ipcMain.handle("queue:add", (_event: IpcMainInvokeEvent, request: unknown) => {
  if (!queueService) {
    throw new Error("Queue service not initialized");
  }
  return queueService.add(
    assertObject<GenerationRequest>(request, "generation request"),
  );
});

ipcMain.handle("queue:cancel", (_event: IpcMainInvokeEvent, id: unknown) => {
  if (!queueService) {
    throw new Error("Queue service not initialized");
  }
  return queueService.cancel(assertString(id, "queue item ID"));
});

ipcMain.handle("queue:remove", (_event: IpcMainInvokeEvent, id: unknown) => {
  if (!queueService) {
    throw new Error("Queue service not initialized");
  }
  return queueService.remove(assertString(id, "queue item ID"));
});

ipcMain.handle("queue:retry", (_event: IpcMainInvokeEvent, id: unknown) => {
  if (!queueService) {
    throw new Error("Queue service not initialized");
  }
  return queueService.retry(assertString(id, "queue item ID"));
});

ipcMain.handle("queue:list", () => {
  if (!queueService) {
    throw new Error("Queue service not initialized");
  }
  return queueService.list();
});

ipcMain.handle("queue:status", () => {
  if (!queueService) {
    throw new Error("Queue service not initialized");
  }
  return queueService.getStatus();
});

// ============================================================================
// Output Path IPC Handlers
// ============================================================================

interface BuildOutputPathInput {
  themeId: string | null;
  templateId: string | null;
  templateValues: Record<string, string> | null;
  variableOrder?: string[];
  seed: number;
  timestamp?: number;
}

ipcMain.handle(
  "output:buildPath",
  (_event: IpcMainInvokeEvent, options: unknown) => {
    return buildOutputPath(
      assertObject<BuildOutputPathInput>(options, "output path options"),
    );
  },
);

// ============================================================================
// History IPC Handlers
// ============================================================================

ipcMain.handle(
  "history:list",
  (_event: IpcMainInvokeEvent, options: unknown) => {
    const opts = options
      ? assertObject<ListGenerationsOptions>(options, "history list options")
      : undefined;
    return listGenerations(opts);
  },
);

ipcMain.handle(
  "history:count",
  (_event: IpcMainInvokeEvent, options: unknown) => {
    const opts = options
      ? assertObject<{ themeId?: string; templateId?: string }>(
          options,
          "history count options",
        )
      : undefined;
    return countGenerations(opts);
  },
);

// ============================================================================
// Settings IPC Handlers
// ============================================================================

ipcMain.handle("settings:get", () => getSettings());

ipcMain.handle(
  "settings:set",
  (_event: IpcMainInvokeEvent, settings: unknown) => {
    saveSettings(assertObject<AppSettings>(settings, "settings"));
    return getSettings();
  },
);

// ============================================================================
// App lifecycle
// ============================================================================

app.whenReady().then(() => {
  // Register custom protocol for serving local files
  protocol.handle("forge-file", (request) => {
    const filePath = request.url.replace("forge-file://", "");
    return net.fetch(`file://${filePath}`);
  });

  // Initialize database
  initDatabase();

  // Initialize and start queue service
  queueService = createQueueService();
  queueService.start();

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
  // Stop queue service before closing database
  queueService?.stop();
  closeDatabase();
});
