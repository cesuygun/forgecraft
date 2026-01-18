import type { View } from "./Forge";

interface Props {
	activeView: View;
	onViewChange: (view: View) => void;
}

const VIEWS: { id: View; label: string; icon: string }[] = [
	{ id: "themes", label: "Themes", icon: "🎨" },
	{ id: "templates", label: "Templates", icon: "📋" },
	{ id: "history", label: "History", icon: "🖼️" },
	{ id: "queue", label: "Queue", icon: "📥" },
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
				<button
					className={`nav-item ${activeView === "settings" ? "active" : ""}`}
					onClick={() => onViewChange("settings")}
				>
					<span className="icon">⚙️</span>
					<span className="label">Settings</span>
				</button>
			</div>
		</nav>
	);
};
