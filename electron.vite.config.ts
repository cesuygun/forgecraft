import { resolve } from "path";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

export default defineConfig({
	main: {
		plugins: [externalizeDepsPlugin()],
		resolve: {
			alias: {
				"@": resolve("src"),
				"@main": resolve("src/main"),
				"@shared": resolve("src/shared"),
			},
		},
	},
	preload: {
		plugins: [externalizeDepsPlugin()],
		resolve: {
			alias: {
				"@shared": resolve("src/shared"),
			},
		},
	},
	renderer: {
		resolve: {
			alias: {
				"@": resolve("src"),
				"@renderer": resolve("src/renderer/src"),
				"@shared": resolve("src/shared"),
			},
		},
		plugins: [react()],
	},
});
