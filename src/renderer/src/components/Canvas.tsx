import type { View } from "./Forge";

interface Props {
	view: View;
}

const VIEW_TITLES: Record<View, string> = {
	themes: "Themes",
	templates: "Templates",
	history: "History",
	queue: "Queue",
};

export const Canvas = ({ view }: Props) => {
	return (
		<main className="canvas">
			<div className="canvas-header">
				<h2>{VIEW_TITLES[view]}</h2>
			</div>

			<div className="canvas-content">
				{view === "themes" && <ThemesView />}
				{view === "templates" && <TemplatesView />}
				{view === "history" && <HistoryView />}
				{view === "queue" && <QueueView />}
			</div>
		</main>
	);
};

const ThemesView = () => {
	return (
		<div className="themes-view">
			<div className="empty-state">
				<span className="icon">🎨</span>
				<h3>No Themes Yet</h3>
				<p>
					Themes define your visual style. Create one to ensure consistent
					generation across all your assets.
				</p>
				<button className="primary">Create Theme</button>
			</div>
		</div>
	);
};

const TemplatesView = () => {
	return (
		<div className="templates-view">
			<div className="empty-state">
				<span className="icon">📋</span>
				<h3>No Templates Yet</h3>
				<p>
					Templates define generation structure with variable axes. Create one
					to generate consistent asset variations.
				</p>
				<button className="primary">Create Template</button>
			</div>
		</div>
	);
};

const HistoryView = () => {
	return (
		<div className="history-view">
			<div className="empty-state">
				<span className="icon">🖼️</span>
				<h3>No Generations Yet</h3>
				<p>
					Your generated images will appear here. Use the Generation Panel on
					the right to create your first asset.
				</p>
			</div>
		</div>
	);
};

const QueueView = () => {
	return (
		<div className="queue-view">
			<div className="empty-state">
				<span className="icon">📥</span>
				<h3>Queue Empty</h3>
				<p>
					No pending generations. Add items to the queue from the Generation
					Panel or use &quot;Generate All&quot; on a template.
				</p>
			</div>
		</div>
	);
};
