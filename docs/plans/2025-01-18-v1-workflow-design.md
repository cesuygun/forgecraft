# Forgecraft V1 Workflow Design

## Overview

Full workflow design for theme-based, template-driven game asset generation with local AI.

**Goal:** Generate consistent game sprites/UI through a layered system where themes define style, templates define structure, and a queue manages generation.

**Target Use Case:** Hero Legends idle-RPG (5 races × 6 jobs × 3 tiers × 5 rarities = massive asset matrix)

---

## Design Note

This design intentionally simplifies the data model from the existing `types.ts`. The existing types were exploratory and speculative (ControlNet, animations, 9-slice guides). This design represents the actual V1 scope. Existing type definitions in `src/shared/types.ts` should be replaced during implementation, not extended.

---

## Data Model

### Themes (`~/.forgecraft/themes/{id}.json`)

Themes define visual style. Stored as portable JSON files.

```typescript
interface Theme {
  id: string;
  name: string;
  stylePrompt: string;           // "pixel art, chibi style, dark fantasy"
  negativePrompt: string;        // "blurry, low quality, watermark"
  defaults: {
    model: string;               // "dreamshaper-xl"
    steps: number;
    cfgScale: number;
    width: number;
    height: number;
  };
  createdAt: string;             // ISO timestamp
  updatedAt: string;
}
```

**Note:** `loraPath` and `referenceImages` are deferred to V2 (LoRA training feature).

**Validation Rules (implemented in CRUD layer):**
- `id`: lowercase alphanumeric + hyphens, 1-64 chars, must be unique
- `name`: 1-100 chars
- `stylePrompt` / `negativePrompt`: 1-2000 chars
- `defaults.steps`: 1-150
- `defaults.cfgScale`: 1.0-30.0
- `defaults.width` / `height`: 64-2048, must be divisible by 8

### Templates (`~/.forgecraft/templates/{id}.json`)

Templates define generation structure with variable axes. Stored as portable JSON files.

```typescript
interface Template {
  id: string;
  name: string;                  // "Hero Legends Characters"
  variables: TemplateVariable[]; // Defines the axes of variation
  promptPattern: string;         // "{race} {job}, {rarity} quality, idle pose"
  createdAt: string;
  updatedAt: string;
}

interface TemplateVariable {
  name: string;                  // "race"
  options: VariableOption[];
}

interface VariableOption {
  id: string;                    // "orc"
  label: string;                 // "Orc"
  promptFragment: string;        // "orc, green skin, tusks, muscular"
}
```

**Template Validation Rules:**
- `id`: lowercase alphanumeric + hyphens, 1-64 chars, must be unique
- `name`: 1-100 chars
- `promptPattern`: 1-2000 chars, must contain at least one `{variable}`
- `variables`: 1-10 variables per template
- `variable.name`: lowercase alphanumeric + underscores, 1-32 chars
- `variable.options`: 1-100 options per variable
- `option.id`: lowercase alphanumeric + underscores, 1-32 chars
- `option.promptFragment`: 1-500 chars

### Template Example: Equipment Icons

Instead of writing 25 separate prompts for 5 equipment slots × 5 rarities:

```json
{
  "id": "equipment-icons",
  "name": "Equipment Icons",
  "variables": [
    {
      "name": "slot",
      "options": [
        { "id": "boots", "label": "Boots", "promptFragment": "boots, footwear, greaves" },
        { "id": "helmet", "label": "Helmet", "promptFragment": "helmet, headgear, helm" },
        { "id": "chest", "label": "Chest", "promptFragment": "chest armor, breastplate" },
        { "id": "weapon", "label": "Weapon", "promptFragment": "sword, blade, weapon" },
        { "id": "shield", "label": "Shield", "promptFragment": "shield, buckler, guard" }
      ]
    },
    {
      "name": "rarity",
      "options": [
        { "id": "common", "label": "Common", "promptFragment": "simple, basic, dull metal, common quality" },
        { "id": "uncommon", "label": "Uncommon", "promptFragment": "iron, sturdy, basic design, uncommon quality" },
        { "id": "rare", "label": "Rare", "promptFragment": "steel, polished, reinforced, rare quality" },
        { "id": "epic", "label": "Epic", "promptFragment": "mithril, shimmering silver, magical glow, epic quality" },
        { "id": "legendary", "label": "Legendary", "promptFragment": "divine, golden, radiant, holy light, legendary quality" }
      ]
    }
  ],
  "promptPattern": "{rarity} {slot}, game icon"
}
```

"Generate All" produces 25 images automatically.

---

## Prompt Composition

### Order of Composition

When generating with both theme and template:

```
Final Prompt = "{theme.stylePrompt}, {interpolated_template_pattern}"
Final Negative = "{theme.negativePrompt}"
```

**Example:**
- Theme stylePrompt: `"pixel art, chibi style, dark fantasy, detailed"`
- Template pattern: `"{rarity} {slot}, game icon"`
- Selected values: `{ rarity: "epic", slot: "boots" }`

**Result:**
```
Prompt: "pixel art, chibi style, dark fantasy, detailed, mithril, shimmering silver, magical glow, epic quality boots, footwear, greaves, game icon"
Negative: "blurry, low quality, watermark"
```

### Pattern Interpolation Rules

1. Variables in pattern use `{variableName}` syntax
2. Each `{variable}` is replaced with the selected option's `promptFragment`
3. **All variables must have a selected value** — no optional variables in V1
4. Unknown variables in pattern trigger a **validation error on template save** — the UI shows which variables in the pattern don't match any defined variable names, blocking save until fixed. At generation time, any unknown variables (due to data corruption) are left as-is with a warning logged, but generation proceeds.

### Raw Prompt Mode

When no template is selected, the Generation Panel shows a text area for direct prompt input:

```
┌─────────────────────────────────────┐
│ Theme: [Hero Legends Style ▼]       │
│ Template: [None ▼]                  │
│                                     │
│ Prompt:                             │
│ ┌─────────────────────────────────┐ │
│ │ orc warrior, green skin, heavy  │ │
│ │ armor, battle axe, idle pose    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Generate]                          │
└─────────────────────────────────────┘
```

Theme's stylePrompt is still prepended. To generate with NO theme influence, select "None" for theme as well.

---

## Generation System

### Generation Request

What goes into the queue:

```typescript
interface GenerationRequest {
  id: string;

  // Source tracking (nullable - for raw prompts these are null)
  themeId: string | null;
  templateId: string | null;
  templateValues: Record<string, string> | null; // {race: "orc", job: "warrior_t1"}

  // Final resolved values (computed from theme + template + overrides)
  prompt: string;
  negativePrompt: string;
  model: string;
  width: number;
  height: number;
  steps: number;
  cfgScale: number;
  seed: number | null;           // null = random, captured after generation

  // Output
  outputPath: string;            // Where the image will be saved
}
```

### Database Schema (SQLite: `~/.forgecraft/forgecraft.db`)

**Migration Strategy:**

The database uses a `schema_version` table to track migrations:

```sql
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);
```

On startup, the app checks `schema_version` and runs any pending migrations sequentially. Each migration is a versioned SQL file or function. This is implemented in Phase 1.

**Queue Table:**
```sql
CREATE TABLE generation_queue (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, generating, complete, failed
  request TEXT NOT NULL,                   -- JSON: full GenerationRequest
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  error TEXT,                              -- Error message if failed
  result_seed INTEGER                      -- Captured seed after generation
);

CREATE INDEX idx_queue_status ON generation_queue(status);
```

**History Table:**
```sql
CREATE TABLE generations (
  id TEXT PRIMARY KEY,
  theme_id TEXT,                           -- NULL if raw prompt
  template_id TEXT,                        -- NULL if raw prompt
  template_values TEXT,                    -- JSON: {race: "orc"} or NULL
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  seed INTEGER NOT NULL,
  output_path TEXT NOT NULL,
  model TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  steps INTEGER NOT NULL,
  cfg_scale REAL NOT NULL,
  generation_time_ms INTEGER,              -- How long it took
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_generations_theme ON generations(theme_id);
CREATE INDEX idx_generations_template ON generations(template_id);
```

### Generation Flow

1. User picks theme + template + values (or writes raw prompt)
2. System resolves final prompt using composition rules
3. `GenerationRequest` created and inserted into `generation_queue`
4. Queue processor picks up pending items sequentially
5. sd-cpp runs generation, progress reported to UI
6. On success: move to `generations` table, save image to output folder
7. On failure: mark as `failed` with error message, leave in queue for retry

---

## "Generate All" Behavior

**"Generate All" queues ALL combinations of the selected template variables.**

### Example: Equipment Icons Template

With 5 slots × 5 rarities = 25 combinations:

| Queue Position | slot | rarity |
|---------------|------|--------|
| 1 | boots | common |
| 2 | boots | uncommon |
| 3 | boots | rare |
| ... | ... | ... |
| 25 | shield | legendary |

### UI for Generate All

```
┌─────────────────────────────────────┐
│ Template: [Equipment Icons ▼]       │
│                                     │
│ Slot: [✓ All] or [Boots ▼]         │
│ Rarity: [✓ All] or [Epic ▼]        │
│                                     │
│ [Generate] [Generate All: 25]       │
└─────────────────────────────────────┘
```

- Each variable dropdown has an "All" checkbox
- "Generate All" button shows count of combinations
- Clicking "Generate All" queues all combinations at once
- Single "Generate" uses current dropdown selections (one image)

### Partial "Generate All"

User can select "All" for some variables and specific values for others:

- Slot: **All** (5 options)
- Rarity: **Epic** (1 option)

Result: 5 images (all slots, but only epic rarity)

---

## Error Handling & Recovery

### Queue Processor Failures

| Failure Type | Behavior |
|--------------|----------|
| sd-cpp crashes | Mark item as `failed`, log error, continue to next item |
| Disk full | Mark as `failed` with "Disk full" error, pause queue, notify user |
| Model missing | Mark as `failed` with "Model not found" error, continue |
| App quit mid-generation | On restart, reset `generating` items to `pending` |

### Recovery Strategy

```typescript
// On app startup
UPDATE generation_queue
SET status = 'pending', started_at = NULL
WHERE status = 'generating';
```

This ensures interrupted generations are retried automatically.

### User Actions

- **Retry failed:** Reset status to `pending`, clear error
- **Cancel pending:** Delete from queue (not started yet)
- **Cancel generating:** Kill sd-cpp process, mark as `failed` with "Cancelled by user"

### Cancellation Semantics

- **Pending items:** Can be deleted from queue
- **Generating item:** sd-cpp process is killed via `process.kill()`, marked as failed
- **Batch cancel:** Cancel all pending items, optionally kill current generation

---

## Output Organization

### Folder Structure

```
~/.forgecraft/
├── themes/                    # JSON files
│   └── hero-legends.json
├── templates/                 # JSON files
│   └── hero-characters.json
│   └── equipment-icons.json
├── models/                    # SD models (symlink or actual)
├── output/                    # Generated images
│   └── {theme}/
│       └── {template}/
│           └── {var1}-{var2}-{varN}/
│               └── {seed}.png
└── forgecraft.db              # SQLite (queue + history)
```

### Example for Hero Legends

```
output/
└── hero-legends/
    └── hero-characters/
        ├── orc-warrior_t1-common/
        │   ├── 123456.png
        │   └── 789012.png
        └── elf-mage_t2-legendary/
            └── 901234.png
    └── equipment-icons/
        ├── boots-common/
        │   └── 345678.png
        └── boots-legendary/
            └── 567890.png
```

### Design Decisions

- **Seed as filename:** Unique, enables regeneration, no collisions
- **Themeless generations:** `output/_raw/{timestamp}-{seed}.png`
- **Templateless generations:** `output/{theme}/_raw/{timestamp}-{seed}.png`

---

## UI Structure

### Layout (3-panel)

```
┌─────────────┬────────────────────────────┬──────────────────┐
│   Sidebar   │         Canvas             │   Generation     │
│             │                            │     Panel        │
│ • Themes    │  [Grid of generated        │                  │
│ • Templates │   images from history]     │  Theme: [▼]      │
│ • History   │                            │  Template: [▼]   │
│ • Queue     │                            │                  │
│             │                            │  -- Variables -- │
│             │                            │  Slot: [▼]       │
│             │                            │  Rarity: [▼]     │
│             │                            │                  │
│             │                            │  [Generate]      │
│             │                            │  [Generate All]  │
│ ─────────── │                            │                  │
│ ⚙ Settings  │                            │  ── Queue ──     │
│             │                            │  3 pending...    │
└─────────────┴────────────────────────────┴──────────────────┘
```

### Views (Breaking Change from Bootstrap)

**Note:** This replaces the bootstrap's asset-type views (`characters`, `ui`, `items`, `effects`) with workflow-based views. The bootstrap views should be removed.

| View | Purpose |
|------|---------|
| **Themes** | List, create, edit, delete themes |
| **Templates** | List, create, edit, delete templates |
| **History** | Browse all generated images with filters |
| **Queue** | Monitor progress, retry failed, cancel pending |

### Generation Panel (Always Visible)

The right panel is always visible regardless of sidebar selection:

1. Theme dropdown (optional)
2. Template dropdown (optional, shows "Raw Prompt" textarea if None)
3. Dynamic variable dropdowns (based on selected template)
4. Generate / Generate All buttons
5. Mini queue status at bottom

---

## Implementation Phases

### Phase 1: Core Infrastructure ✅
- [x] Add `better-sqlite3` dependency + `@electron/rebuild`
- [x] Create database module (init, migrations)
- [x] Theme CRUD (load/save JSON files)
- [x] Template CRUD (load/save JSON files)
- [x] Output folder utilities

### Phase 2: Queue & Generation ✅
- [x] Generation queue processor (sequential)
- [x] Wire sd-cpp to queue processor
- [x] Progress reporting via IPC
- [x] Generation history recording
- [x] Error handling and recovery on startup

**IPC Channels (Phase 2):**

```typescript
// Queue status updates (main → renderer)
'queue:status' → { pending: number; generating: string | null; completed: number; failed: number }

// Generation progress (main → renderer)
'generation:progress' → { requestId: string; percent: number; step: number; totalSteps: number }

// Generation complete (main → renderer)
'generation:complete' → { requestId: string; outputPath: string; seed: number }

// Generation failed (main → renderer)
'generation:failed' → { requestId: string; error: string }

// Queue commands (renderer → main, via invoke)
'queue:add' → GenerationRequest → { id: string }
'queue:cancel' → { id: string } → { success: boolean }
'queue:retry' → { id: string } → { success: boolean }
'queue:list' → void → QueueItem[]
```

### Phase 3: Basic UI ✅
- [x] Replace bootstrap views with workflow views
- [x] Theme list view
- [x] Template list view
- [x] Raw prompt generation (no template)
- [x] Queue status display

### Phase 4: Template System (Partially Complete)
- [x] Template creation UI (variables, options, pattern)
- [x] Template variable dropdowns in generation panel
- [x] Prompt composition (theme + template interpolation)
- [ ] "Generate All" with combination counting

### Phase 5: History & Polish
- [ ] History browser with filters (by theme, template, date)
- [ ] Queue management UI (cancel, retry)
- [ ] Image preview in canvas
- [ ] Settings panel (model selection, default steps/cfg)

### Deferred (V2)
- [ ] LoRA training pipeline
- [ ] Reference images for themes
- [ ] ControlNet pose editor
- [ ] IP-Adapter for reference-based generation
- [ ] Asset tagging and search

---

## Architecture Principles

1. **Layered independence:** Theme, Template, and Queue work standalone. Generate without templates. Have templates without themes. Queue doesn't care what created the request.

2. **Hybrid persistence:** JSON for user-created content (portable, editable, version-controllable), SQLite for high-volume operational data (queryable, performant).

3. **Sequential generation:** All generation goes through a single-threaded queue. No parallel generation (memory constraints on M3 Pro with SDXL).

4. **Graceful degradation:** If theme JSON is deleted, history still shows the generations (prompt is stored). Orphaned references are handled, not crashed on.

---

## Technical Notes

### Native Dependencies

`better-sqlite3` requires native compilation. Add to build process:

```json
{
  "scripts": {
    "postinstall": "electron-rebuild"
  },
  "devDependencies": {
    "@electron/rebuild": "^3.x"
  }
}
```

### Memory Budget

SDXL on M3 Pro uses ~10GB unified memory. With 36GB total:
- Safe for sequential generation
- Do NOT parallelize generation
- Queue size is unlimited (just disk space for output)

### sd-cpp Output Parsing

Current parsing is fragile (regex on stderr). Consider:
- Logging raw output for debugging
- Graceful fallback if parsing fails (generation still succeeds, just no progress %)
- Future: version check sd-cpp binary
