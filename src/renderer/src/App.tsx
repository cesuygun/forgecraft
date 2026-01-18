import { useState, useEffect } from "react";
import { SetupWizard } from "./components/SetupWizard";
import { Forge } from "./components/Forge";

const App = () => {
	const [isReady, setIsReady] = useState<boolean | null>(null);
	const [needsSetup, setNeedsSetup] = useState(false);

	useEffect(() => {
		const checkSetup = async () => {
			const sdInstalled = await window.forge.sd.isInstalled();
			const installedModels = await window.forge.models.installed();

			if (!sdInstalled || installedModels.length === 0) {
				setNeedsSetup(true);
			}
			setIsReady(true);
		};
		checkSetup();
	}, []);

	if (isReady === null) {
		return (
			<div className="loading-screen">
				<div className="loading-spinner" />
				<p>Initializing Forgecraft...</p>
			</div>
		);
	}

	if (needsSetup) {
		return <SetupWizard onComplete={() => setNeedsSetup(false)} />;
	}

	return <Forge />;
};

export default App;
