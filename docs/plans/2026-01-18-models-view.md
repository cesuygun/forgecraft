# Models View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Models view to browse, download, and manage SD models.

**Architecture:** New sidebar nav item "Models" with a grid of model cards. Each card shows model info and download/installed status. Downloads show inline progress bars.

**Tech Stack:** React, existing forge API (models.list, models.installed, models.download)

---

### Task 1: Add Models to View Type and Sidebar

**Files:**
- Modify: `src/renderer/src/components/Forge.tsx`
- Modify: `src/renderer/src/components/Sidebar.tsx`

**Step 1: Update View type**

In `src/renderer/src/components/Forge.tsx`, update the View type:

```typescript
export type View = "themes" | "templates" | "models" | "history" | "queue" | "settings";
```

**Step 2: Add Models icon to Sidebar**

In `src/renderer/src/components/Sidebar.tsx`, add the icon component after the existing icons:

```tsx
const IconModels = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);
```

**Step 3: Add Models to VIEWS array**

In `Sidebar.tsx`, add to the VIEWS array after templates:

```typescript
const VIEWS: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: "themes", label: "Themes", icon: <IconThemes /> },
  { id: "templates", label: "Templates", icon: <IconTemplates /> },
  { id: "models", label: "Models", icon: <IconModels /> },
  { id: "history", label: "History", icon: <IconHistory /> },
  { id: "queue", label: "Queue", icon: <IconQueue /> },
];
```

**Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: May show error about missing "models" case in Canvas.tsx (expected, will fix in Task 2)

---

### Task 2: Add ModelsView Component

**Files:**
- Modify: `src/renderer/src/components/Canvas.tsx`

**Step 1: Add VIEW_TITLES entry**

Add to VIEW_TITLES:

```typescript
const VIEW_TITLES: Record<View, string> = {
  themes: "Themes",
  templates: "Templates",
  models: "Models",
  history: "History",
  queue: "Queue",
  settings: "Settings",
};
```

**Step 2: Add ModelsView to Canvas render**

In the Canvas component return, add:

```tsx
{view === "models" && <ModelsView />}
```

**Step 3: Create ModelsView component**

Add the ModelsView component in Canvas.tsx (after existing view components):

```tsx
const ModelsView = () => {
  const [models, setModels] = useState<SdModel[]>([]);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  const loadModels = useCallback(async () => {
    try {
      setError(null);
      const [allModels, installed] = await Promise.all([
        window.forge.models.list(),
        window.forge.models.installed(),
      ]);
      setModels(allModels);
      setInstalledIds(new Set(installed.map((m) => m.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load models");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // Subscribe to download progress with cleanup
  useEffect(() => {
    let mounted = true;
    const unsubscribe = window.forge.models.onDownloadProgress((progress) => {
      if (mounted && progress.modelId === downloading) {
        setDownloadProgress(progress.percent);
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [downloading]);

  const handleDownload = async (modelId: string) => {
    setDownloading(modelId);
    setDownloadProgress(0);
    try {
      await window.forge.models.download(modelId);
      setInstalledIds((prev) => new Set([...prev, modelId]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(null);
      setDownloadProgress(0);
    }
  };

  const formatSize = (bytes: number): string => {
    const gb = bytes / 1_000_000_000;
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1_000_000).toFixed(0)} MB`;
  };

  if (isLoading) {
    return (
      <div className="models-view">
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Loading models...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="models-view">
        <div className="error-state">
          <span className="icon">!</span>
          <h3>Error Loading Models</h3>
          <p>{error}</p>
          <button className="primary" onClick={loadModels}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="models-view">
        <div className="empty-state">
          <span className="icon">M</span>
          <h3>No Models Available</h3>
          <p>No models are defined in the catalog.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="models-view">
      <div className="models-grid">
        {models.map((model) => {
          const isInstalled = installedIds.has(model.id);
          const isDownloading = downloading === model.id;

          return (
            <div key={model.id} className="model-card" data-testid={`model-card-${model.id}`}>
              <div className="model-card-header">
                <span className="model-icon">M</span>
                <div className="model-title">
                  <h4 className="model-name">{model.name}</h4>
                  <span className="model-type-badge">{model.type.toUpperCase()}</span>
                </div>
              </div>
              {model.description && (
                <p className="model-description">{model.description}</p>
              )}
              <div className="model-card-meta">
                <span className="meta-item">{formatSize(model.size)}</span>
                {model.tags?.map((tag) => (
                  <span key={tag} className="meta-tag">{tag}</span>
                ))}
              </div>
              <div className="model-card-actions">
                {isDownloading ? (
                  <div className="download-progress" data-testid={`download-progress-${model.id}`}>
                    <div
                      className="download-progress-bar"
                      style={{ width: `${downloadProgress}%` }}
                    />
                    <span className="download-progress-text">{downloadProgress}%</span>
                  </div>
                ) : isInstalled ? (
                  <span className="installed-badge" data-testid={`installed-${model.id}`}>Installed</span>
                ) : (
                  <button
                    className="primary"
                    onClick={() => handleDownload(model.id)}
                    data-testid={`download-${model.id}`}
                  >
                    Download
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

**Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

---

### Task 3: Add CSS Styles for ModelsView

**Files:**
- Modify: `src/renderer/src/styles/global.css`

**Step 1: Add models view styles**

Add after the existing themes-view styles:

```css
/* Models View */
.models-view {
  padding: 24px;
}

.models-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.model-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.model-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.model-icon {
  width: 36px;
  height: 36px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: var(--accent-primary);
}

.model-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.model-name {
  margin: 0;
  font-size: 15px;
}

.model-type-badge {
  font-size: 11px;
  padding: 2px 6px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-weight: 500;
}

.model-description {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.4;
}

.model-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 13px;
  color: var(--text-muted);
}

.meta-tag {
  padding: 2px 6px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
}

.model-card-actions {
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.installed-badge {
  display: inline-block;
  padding: 6px 12px;
  background: rgba(46, 204, 113, 0.15);
  color: var(--success);
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
}

.download-progress {
  position: relative;
  height: 32px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.download-progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--accent-primary);
  transition: width 0.2s ease;
}

.download-progress-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  z-index: 1;
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

---

### Task 4: Test End-to-End

**Manual Testing Steps:**

1. Start the app: `npm run dev`
2. Verify "Models" appears in sidebar between Templates and History
3. Click Models - should show grid of 3 models
4. Verify DreamShaper XL shows "Installed" badge
5. Verify Pixel Art XL and SDXL Base show "Download" button
6. Click Download on Pixel Art XL
7. Verify progress bar appears and updates
8. After download completes, verify "Installed" badge appears
9. Navigate away and back - state should persist

---

## Notes

- Uses existing `window.forge.models` API - no backend changes needed
- Matches existing card patterns from ThemesView
- Download progress uses existing IPC subscription
- Model deletion not implemented (YAGNI - can add later if needed)
