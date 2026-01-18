# Background Removal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically remove backgrounds from generated images, saving both original and transparent versions.

**Architecture:** After SD generates an image, if the `removeBackground` setting is enabled (default: true), we process it through `@imgly/background-removal-node` to create a transparent PNG. Both versions are saved. The UI displays the transparent version with a checkerboard background pattern.

**Tech Stack:** @imgly/background-removal-node, Electron IPC, React

---

### Task 1: Add removeBackground Setting to AppSettings

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/main/data/settings.ts`

**Step 1: Add removeBackground to AppSettings type**

In `src/shared/types.ts`, add to the `AppSettings` interface:

```typescript
export interface AppSettings {
  defaultModel: string;
  defaultSteps: number;
  defaultCfgScale: number;
  defaultWidth: number;
  defaultHeight: number;
  removeBackground: boolean; // Add this line
}
```

**Step 2: Update default settings**

In `src/main/data/settings.ts`, update the `DEFAULT_SETTINGS` constant:

```typescript
const DEFAULT_SETTINGS: AppSettings = {
  defaultModel: "dreamshaper-xl",
  defaultSteps: 20,
  defaultCfgScale: 7,
  defaultWidth: 512,
  defaultHeight: 512,
  removeBackground: true, // Add this line
};
```

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

---

### Task 2: Add Background Removal Service

**Files:**
- Create: `src/main/services/background-removal.ts`

**Step 1: Install dependency**

Run: `npm install @imgly/background-removal-node`

**Step 2: Create background removal service**

Create `src/main/services/background-removal.ts`:

```typescript
// ABOUTME: Background removal service using @imgly/background-removal-node
// ABOUTME: Processes images to create transparent PNG versions

import { removeBackground as imglyRemoveBackground } from "@imgly/background-removal-node";
import { readFile, writeFile } from "fs/promises";

export interface RemoveBackgroundResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

/**
 * Remove background from an image and save as transparent PNG
 * @param inputPath - Path to the source image
 * @param outputPath - Path where transparent image will be saved
 * @returns Result with success status and output path
 */
export const removeBackground = async (
  inputPath: string,
  outputPath: string
): Promise<RemoveBackgroundResult> => {
  try {
    console.log(`[BackgroundRemoval] Processing: ${inputPath}`);

    // Read the input image
    const imageData = await readFile(inputPath);
    const blob = new Blob([imageData], { type: "image/png" });

    // Remove background
    const resultBlob = await imglyRemoveBackground(blob, {
      model: "medium",
      output: {
        format: "image/png",
      },
    });

    // Convert blob to buffer and save
    const arrayBuffer = await resultBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(outputPath, buffer);

    console.log(`[BackgroundRemoval] Saved: ${outputPath}`);
    return { success: true, outputPath };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[BackgroundRemoval] Failed: ${message}`);
    return { success: false, error: message };
  }
};

/**
 * Generate the transparent image path from original path
 * image.png -> image-transparent.png
 */
export const getTransparentPath = (originalPath: string): string => {
  return originalPath.replace(/\.png$/, "-transparent.png");
};
```

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

---

### Task 3: Integrate Background Removal into Queue Processor

**Files:**
- Modify: `src/main/services/queue-processor.ts`

**Step 1: Import background removal and settings**

Add imports at the top of `src/main/services/queue-processor.ts`:

```typescript
import { removeBackground, getTransparentPath } from "./background-removal";
import { getSettings } from "../data";
```

**Step 2: Add background removal after image generation**

Find the section where the image is saved (after `generateImage` completes successfully) and add background removal:

After the line that saves the generation to the database, add:

```typescript
// Remove background if setting is enabled
const settings = getSettings();
if (settings.removeBackground) {
  const transparentPath = getTransparentPath(item.request.outputPath);
  const bgResult = await removeBackground(item.request.outputPath, transparentPath);
  if (!bgResult.success) {
    console.error(`[QueueProcessor] Background removal failed: ${bgResult.error}`);
    // Continue anyway - original image is still saved
  }
}
```

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

---

### Task 4: Update GenerationRecord to Track Transparent Path

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/main/db/database.ts`
- Modify: `src/main/db/index.ts`

**Step 1: Add transparentPath to GenerationRecord type**

In `src/shared/types.ts`, update the `GenerationRecord` interface:

```typescript
export interface GenerationRecord {
  id: string;
  themeId: string | null;
  templateId: string | null;
  templateValues: Record<string, string> | null;
  prompt: string;
  negativePrompt: string | null;
  seed: number;
  outputPath: string;
  transparentPath: string | null; // Add this line
  model: string;
  width: number;
  height: number;
  steps: number;
  cfgScale: number;
  generationTimeMs: number | null;
  createdAt: number;
}
```

**Step 2: Update database schema**

In `src/main/db/database.ts`, add migration to add the column if it doesn't exist. Find the `initDatabase` function and add after the CREATE TABLE:

```typescript
// Add transparentPath column if it doesn't exist (migration)
db.exec(`
  ALTER TABLE generations ADD COLUMN transparent_path TEXT;
`);
```

Wrap it in try-catch to handle the case where column already exists:

```typescript
try {
  db.exec(`ALTER TABLE generations ADD COLUMN transparent_path TEXT;`);
} catch {
  // Column already exists, ignore
}
```

**Step 3: Update saveGeneration function**

Update the INSERT statement in `saveGeneration` to include `transparent_path`:

```typescript
const stmt = db.prepare(`
  INSERT INTO generations (
    id, theme_id, template_id, template_values, prompt, negative_prompt,
    seed, output_path, transparent_path, model, width, height, steps, cfg_scale,
    generation_time_ms, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
```

And add the transparentPath parameter to the run call.

**Step 4: Update listGenerations function**

Update the SELECT and mapping to include `transparent_path`:

```typescript
transparentPath: row.transparent_path as string | null,
```

**Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

---

### Task 5: Update Queue Processor to Save Transparent Path

**Files:**
- Modify: `src/main/services/queue-processor.ts`

**Step 1: Update saveGeneration call**

Update the call to `saveGeneration` to include the transparent path:

```typescript
const transparentPath = settings.removeBackground
  ? getTransparentPath(item.request.outputPath)
  : null;

// Save to database with transparent path
saveGeneration({
  // ... existing fields
  transparentPath,
});
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

---

### Task 6: Add Settings UI for Background Removal

**Files:**
- Modify: `src/renderer/src/components/Canvas.tsx`

**Step 1: Add form state for removeBackground**

In the `SettingsView` component, add state:

```typescript
const [formRemoveBackground, setFormRemoveBackground] = useState(true);
```

**Step 2: Initialize from loaded settings**

In `loadSettings`, add:

```typescript
setFormRemoveBackground(loadedSettings.removeBackground);
```

**Step 3: Add to form submission**

In `handleSave`, add to `updatedSettings`:

```typescript
removeBackground: formRemoveBackground,
```

**Step 4: Add to reset handler**

In `handleReset`, add:

```typescript
setFormRemoveBackground(settings.removeBackground);
```

**Step 5: Add UI toggle**

Add a checkbox/toggle in the settings form after the dimensions fields:

```tsx
<div className="form-field">
  <label htmlFor="settings-remove-bg" className="checkbox-label">
    <input
      id="settings-remove-bg"
      type="checkbox"
      checked={formRemoveBackground}
      onChange={(e) => setFormRemoveBackground(e.target.checked)}
    />
    <span>Remove background from generated images</span>
  </label>
  <p className="field-hint">
    Creates a transparent PNG version alongside the original
  </p>
</div>
```

**Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

---

### Task 7: Display Transparent Images with Checkerboard Background

**Files:**
- Modify: `src/renderer/src/styles/global.css`
- Modify: `src/renderer/src/components/ImagePreview.tsx`
- Modify: `src/renderer/src/components/Canvas.tsx`

**Step 1: Add checkerboard CSS pattern**

In `global.css`, add:

```css
/* Checkerboard background for transparent images */
.checkerboard-bg {
  background-image:
    linear-gradient(45deg, #333 25%, transparent 25%),
    linear-gradient(-45deg, #333 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #333 75%),
    linear-gradient(-45deg, transparent 75%, #333 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
  background-color: #222;
}
```

**Step 2: Update ImagePreview to use transparent path**

In `ImagePreview.tsx`, update the image src to prefer transparent path:

```tsx
const imagePath = record.transparentPath || record.outputPath;

// In the img tag:
<img
  src={`forge-file://${imagePath}`}
  alt={record.prompt}
  className="image-preview-image"
  data-testid="image-preview-image"
/>
```

**Step 3: Add checkerboard to image container**

Update the image container class:

```tsx
<div className="image-preview-image-container checkerboard-bg">
```

**Step 4: Update History grid cards**

In the HistoryView in `Canvas.tsx`, update the history card images similarly:

```tsx
const imagePath = gen.transparentPath || gen.outputPath;

<img
  src={`forge-file://${imagePath}`}
  alt={gen.prompt}
  loading="lazy"
/>
```

And add checkerboard to the container:

```tsx
<div className="history-card-image checkerboard-bg">
```

**Step 5: Update Queue view thumbnails**

In QueueView, for completed items, use transparent path:

```tsx
const imagePath = item.request.transparentPath || item.request.outputPath;
```

Note: QueueItem uses request.outputPath, so we need to check if transparent version exists.

**Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

---

### Task 8: Test End-to-End

**Manual Testing Steps:**

1. Start the app: `npm run dev`
2. Go to Settings, verify "Remove background" checkbox is checked by default
3. Generate an image with Torchlight theme
4. Check Queue - should complete successfully
5. Check History - image should display with checkerboard background
6. Click image to preview - should show transparent version
7. Click "Show in Finder" - verify both `.png` and `-transparent.png` exist
8. Go to Settings, uncheck "Remove background"
9. Generate another image
10. Verify only original `.png` is created (no transparent version)

---

## Notes

- Background removal takes a few seconds extra per image
- First run downloads the ML model (~40MB) - subsequent runs use cached model
- If background removal fails, the original image is still saved
- The transparent path is stored in the database for history lookup
