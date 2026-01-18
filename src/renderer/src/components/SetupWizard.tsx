import { useState, useEffect, useCallback } from "react";

type SetupStep = "welcome" | "binary" | "model" | "complete";

interface Props {
	onComplete: () => void;
}

// Anvil/forge icon as SVG
const ForgeIcon = ({ size = 64 }: { size?: number }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		{/* Anvil base */}
		<path
			d="M4 18h16v2H4v-2z"
			fill="currentColor"
			opacity="0.8"
		/>
		{/* Anvil body */}
		<path
			d="M6 14h12l1 4H5l1-4z"
			fill="currentColor"
			opacity="0.9"
		/>
		{/* Anvil top */}
		<path
			d="M3 12h18v2H3v-2z"
			fill="currentColor"
		/>
		{/* Hammer handle */}
		<path
			d="M12 4l6 6-1.5 1.5L12 7l-4.5 4.5L6 10l6-6z"
			fill="var(--accent-primary)"
		/>
		{/* Hammer head */}
		<path
			d="M16 8l2-2 2 2-2 2-2-2z"
			fill="var(--accent-primary)"
		/>
		{/* Sparks */}
		<circle cx="8" cy="10" r="1" fill="var(--gold)" opacity="0.8" />
		<circle cx="10" cy="8" r="0.7" fill="var(--gold)" opacity="0.6" />
		<circle cx="6" cy="8" r="0.5" fill="var(--gold)" opacity="0.4" />
	</svg>
);

// Sparkle/ready icon
const ReadyIcon = ({ size = 64 }: { size?: number }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		{/* Main star */}
		<path
			d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"
			fill="var(--accent-primary)"
		/>
		{/* Inner glow */}
		<path
			d="M12 6l1.2 3.7h3.9l-3.1 2.3 1.2 3.7-3.2-2.3-3.2 2.3 1.2-3.7-3.1-2.3h3.9L12 6z"
			fill="var(--gold)"
			opacity="0.6"
		/>
	</svg>
);

export const SetupWizard = ({ onComplete }: Props) => {
	const [step, setStep] = useState<SetupStep>("welcome");
	const [progress, setProgress] = useState(0);
	const [status, setStatus] = useState("");
	const [error, setError] = useState<string | null>(null);

	const downloadModel = useCallback(async () => {
		setStep("model");
		setStatus("Downloading base model...");
		setProgress(0);

		const cleanup = window.forge.models.onDownloadProgress((p) => {
			setProgress(p.percent);
			const mb = Math.round(p.downloadedBytes / 1_000_000);
			const totalMb = Math.round(p.totalBytes / 1_000_000);
			setStatus(`Downloading model... ${mb}/${totalMb}MB`);
		});

		try {
			// Download the recommended model (DreamShaper XL for painterly game art)
			await window.forge.models.download("dreamshaper-xl");
			cleanup();
			setStep("complete");
		} catch (err) {
			cleanup();
			setError(err instanceof Error ? err.message : "Download failed");
		}
	}, []);

	const installBinary = useCallback(async () => {
		setStep("binary");
		setStatus("Downloading AI engine...");
		setProgress(0);

		const cleanup = window.forge.sd.onInstallProgress((p) => {
			setProgress(p.percent);
			if (p.stage === "downloading") {
				const mb = p.downloadedBytes
					? Math.round(p.downloadedBytes / 1_000_000)
					: 0;
				setStatus(`Downloading AI engine... ${mb}MB`);
			} else if (p.stage === "extracting") {
				setStatus("Extracting...");
			}
		});

		try {
			await window.forge.sd.install();
			cleanup();
			downloadModel();
		} catch (err) {
			cleanup();
			setError(err instanceof Error ? err.message : "Installation failed");
		}
	}, [downloadModel]);

	useEffect(() => {
		// Check if we can skip binary install
		const check = async () => {
			const installed = await window.forge.sd.isInstalled();
			if (installed) {
				const models = await window.forge.models.installed();
				if (models.length > 0) {
					onComplete();
				} else {
					downloadModel();
				}
			}
		};
		if (step === "welcome") {
			check();
		}
	}, [step, onComplete, downloadModel]);

	if (error) {
		return (
			<div className="setup-wizard">
				<div className="setup-content">
					<h1>Setup Failed</h1>
					<p className="error">{error}</p>
					<button onClick={() => window.location.reload()}>Try Again</button>
				</div>
			</div>
		);
	}

	return (
		<div className="setup-wizard">
			<div className="setup-content">
				{step === "welcome" && (
					<>
						<div className="setup-icon">
							<ForgeIcon size={72} />
						</div>
						<h1>Welcome to Forgecraft</h1>
						<p className="setup-description">
							Forge consistent game sprites, UI elements, and assets using local
							AI. No internet required after setup.
						</p>
						<button className="primary" onClick={installBinary}>
							Begin Setup
						</button>
						<p className="setup-note">
							This will download ~7GB of AI models. Make sure you have enough
							space.
						</p>
					</>
				)}

				{(step === "binary" || step === "model") && (
					<>
						<h1>Setting Up</h1>
						<p>{status}</p>
						<div className="progress-bar">
							<div
								className="progress-fill"
								style={{ width: `${progress}%` }}
							/>
						</div>
						<p className="progress-text">{progress}%</p>
					</>
				)}

				{step === "complete" && (
					<>
						<div className="setup-icon">
							<ReadyIcon size={72} />
						</div>
						<h1>Ready to Forge</h1>
						<p className="setup-description">
							Everything is set up. Time to create some amazing game assets!
						</p>
						<button className="primary" onClick={onComplete}>
							Start Creating
						</button>
					</>
				)}
			</div>
		</div>
	);
};
