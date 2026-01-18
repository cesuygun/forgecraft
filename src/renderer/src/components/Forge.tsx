import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Canvas } from "./Canvas";
import { GenerationPanel } from "./GenerationPanel";

export type View = "themes" | "characters" | "ui" | "items" | "effects";

export const Forge = () => {
	const [activeView, setActiveView] = useState<View>("themes");

	return (
		<div className="forge-layout">
			<Sidebar activeView={activeView} onViewChange={setActiveView} />
			<main className="forge-main">
				<Canvas view={activeView} />
			</main>
			<GenerationPanel view={activeView} />
		</div>
	);
};
