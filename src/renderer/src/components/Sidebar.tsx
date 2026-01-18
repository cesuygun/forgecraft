import type { View } from "./Forge";

interface Props {
	activeView: View;
	onViewChange: (view: View) => void;
}

const VIEWS: { id: View; label: string; icon: string }[] = [
	{ id: "themes", label: "Themes", icon: "🎨" },
	{ id: "characters", label: "Characters", icon: "🧙" },
	{ id: "ui", label: "UI Elements", icon: "🖼️" },
	{ id: "items", label: "Items", icon: "⚔️" },
	{ id: "effects", label: "Effects", icon: "✨" },
];

export const Sidebar = ({ activeView, onViewChange }: Props) => {
	return (
		<nav className="sidebar">
			<div className="sidebar-header">
				<span className="logo">⚒️</span>
				<span className="title">Forgecraft</span>
			</div>

			<div className="sidebar-nav">
				{VIEWS.map((view) => (
					<button
						key={view.id}
						className={`nav-item ${activeView === view.id ? "active" : ""}`}
						onClick={() => onViewChange(view.id)}
					>
						<span className="icon">{view.icon}</span>
						<span className="label">{view.label}</span>
					</button>
				))}
			</div>

			<div className="sidebar-footer">
				<button className="nav-item">
					<span className="icon">⚙️</span>
					<span className="label">Settings</span>
				</button>
			</div>
		</nav>
	);
};
