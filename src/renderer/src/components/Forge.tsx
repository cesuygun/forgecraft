// ABOUTME: Main Forge component that orchestrates the three-panel layout
// ABOUTME: Manages view state and passes navigation callbacks between panels

import { useState, useCallback } from "react";
import { Sidebar } from "./Sidebar";
import { Canvas } from "./Canvas";
import { GenerationPanel } from "./GenerationPanel";

export type View = "themes" | "templates" | "history" | "queue" | "settings";

export const Forge = () => {
	const [activeView, setActiveView] = useState<View>("history");

	const handleNavigateToQueue = useCallback(() => {
		setActiveView("queue");
	}, []);

	return (
		<div className="forge-layout">
			<Sidebar activeView={activeView} onViewChange={setActiveView} />
			<Canvas view={activeView} />
			<GenerationPanel onNavigateToQueue={handleNavigateToQueue} />
		</div>
	);
};
