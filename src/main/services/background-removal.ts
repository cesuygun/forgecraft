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

    // Remove background using large model for better edge detection
    const resultBlob = await imglyRemoveBackground(blob, {
      model: "large",
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
