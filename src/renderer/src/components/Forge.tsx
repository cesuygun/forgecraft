import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Canvas } from "./Canvas";
import { GenerationPanel } from "./GenerationPanel";

export type View = "themes" | "templates" | "history" | "queue";

export const Forge = () => {
	const [activeView, setActiveView] = useState<View>("history");

	return (
		<div className="forge-layout">
			<Sidebar activeView={activeView} onViewChange={setActiveView} />
			<Canvas view={activeView} />
			<GenerationPanel />
		</div>
	);
};
