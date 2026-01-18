import type { View } from "./Forge";

interface Props {
	view: View;
}

export const Canvas = ({ view }: Props) => {
	return (
		<div className="canvas">
			<div className="canvas-header">
				<h2>{view.charAt(0).toUpperCase() + view.slice(1)}</h2>
			</div>

			<div className="canvas-content">
				{view === "themes" && <ThemesView />}
				{view === "characters" && <AssetsGrid category="characters" />}
				{view === "ui" && <AssetsGrid category="ui" />}
				{view === "items" && <AssetsGrid category="items" />}
				{view === "effects" && <AssetsGrid category="effects" />}
			</div>
		</div>
	);
};

const ThemesView = () => {
	return (
		<div className="themes-view">
			<div className="empty-state">
				<span className="icon">🎨</span>
				<h3>No Themes Yet</h3>
				<p>
					Create your first theme by uploading reference images or describing
					the style you want.
				</p>
				<button className="primary">Create Theme</button>
			</div>
		</div>
	);
};

const AssetsGrid = ({ category }: { category: string }) => {
	return (
		<div className="assets-grid">
			<div className="empty-state">
				<span className="icon">📦</span>
				<h3>No {category.charAt(0).toUpperCase() + category.slice(1)} Yet</h3>
				<p>Select a theme first, then start generating assets.</p>
			</div>
		</div>
	);
};
