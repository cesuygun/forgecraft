import type { View } from "./Forge";

interface Props {
	activeView: View;
	onViewChange: (view: View) => void;
}

// Simple SVG icons as components
const IconThemes = () => (
	<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
		<circle cx="12" cy="12" r="10" />
		<path d="M12 2a4 4 0 0 0-4 4c0 2 2 3 2 6s-2 4-2 6a4 4 0 0 0 8 0c0-2-2-4-2-6s2-4 2-6a4 4 0 0 0-4-4z" />
	</svg>
);

const IconTemplates = () => (
	<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
		<rect x="3" y="3" width="18" height="18" rx="2" />
		<path d="M3 9h18M9 21V9" />
	</svg>
);

const IconModels = () => (
	<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
		<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
		<polyline points="3.27 6.96 12 12.01 20.73 6.96" />
		<line x1="12" y1="22.08" x2="12" y2="12" />
	</svg>
);

const IconHistory = () => (
	<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
		<rect x="3" y="3" width="7" height="7" rx="1" />
		<rect x="14" y="3" width="7" height="7" rx="1" />
		<rect x="3" y="14" width="7" height="7" rx="1" />
		<rect x="14" y="14" width="7" height="7" rx="1" />
	</svg>
);

const IconQueue = () => (
	<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
		<path d="M4 6h16M4 12h16M4 18h10" />
	</svg>
);

const IconSettings = () => (
	<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
		<circle cx="12" cy="12" r="3" />
		<path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
	</svg>
);

const IconForge = () => (
	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
		<path d="M4 18h16v2H4zM6 14h12l1 4H5zM3 12h18v2H3z" fill="currentColor" stroke="none" />
		<path d="M12 4l5 5-1 1-4-3-4 3-1-1z" fill="var(--accent-primary)" stroke="none" />
	</svg>
);

const VIEWS: { id: View; label: string; icon: React.ReactNode }[] = [
	{ id: "themes", label: "Themes", icon: <IconThemes /> },
	{ id: "templates", label: "Templates", icon: <IconTemplates /> },
	{ id: "models", label: "Models", icon: <IconModels /> },
	{ id: "history", label: "History", icon: <IconHistory /> },
	{ id: "queue", label: "Queue", icon: <IconQueue /> },
];

export const Sidebar = ({ activeView, onViewChange }: Props) => {
	return (
		<nav className="sidebar">
			<div className="sidebar-header">
				<span className="logo"><IconForge /></span>
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
					<span className="icon"><IconSettings /></span>
					<span className="label">Settings</span>
				</button>
			</div>
		</nav>
	);
};
