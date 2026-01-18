import { useState, useEffect, useCallback } from "react";

type SetupStep = "welcome" | "binary" | "model" | "complete";

interface Props {
	onComplete: () => void;
}

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
						<div className="logo">⚒️</div>
						<h1>Welcome to Forgecraft</h1>
						<p>
							Forge consistent game sprites, UI elements, and assets using local
							AI. No internet required after setup.
						</p>
						<button className="primary" onClick={installBinary}>
							Begin Setup
						</button>
						<p className="note">
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
						<div className="logo">✨</div>
						<h1>Ready to Forge</h1>
						<p>
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
