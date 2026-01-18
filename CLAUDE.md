# Forgecraft

Offline game asset forge - consistent sprites, UI elements, and theme-based generation using local AI.

## Project Overview

**Purpose:** Generate game assets (sprites, UI, items, effects) with consistent visual style using local Stable Diffusion models on macOS.

**Target Hardware:** M3 Pro Mac, 36GB unified memory, Apple Silicon optimized

**Art Style Target:** Dark fantasy/ARPG aesthetic (Torchlight, Diablo, pixel-painterly hybrid)

## Hero Legends Use Case

Primary design target is a hero collection idle-RPG with:

### Matrix Generation
- **5 Races:** Human, Orc, Elf, Dwarf, Undead
- **6 Jobs × 3 Tiers:** Warrior→Knight→Paladin, Rogue→Assassin→Shadow Lord, etc.
- **5 Rarities:** Common (gray), Uncommon (green), Rare (blue), Epic (purple), Legendary (orange)
- **Total:** 30 unique base heroes × 3 tiers × 5 rarities = massive asset matrix

### Template System (Planned)
```typescript
// Race templates inject visual descriptors
const RACE_TEMPLATES = {
  human: "human, normal skin, standard proportions",
  orc: "orc, green skin, tusks, muscular",
  elf: "elf, pointed ears, pale skin, slender",
  dwarf: "dwarf, short and stocky, thick beard",
  undead: "undead, pale blue/gray, glowing eyes, skeletal",
};

// Job templates define equipment and pose
const JOB_TEMPLATES = {
  warrior_t1: "silver armor, sword and shield, standing pose",
  warrior_t2: "ornate plate armor, cape, longsword and tower shield, heroic pose",
  warrior_t3: "radiant golden armor, divine sword, white cape, glowing halo",
};

// Combine: `${RACE_TEMPLATES[race]}, ${JOB_TEMPLATES[job]}`
```

### Asset Types
- **Characters:** Heroes at different tiers, poses (idle, attack, death)
- **UI Elements:** Health/mana bars, rarity frames, buttons, icons
- **Items:** Weapons, armor by rarity (5 colors × item types)
- **Effects:** Critical hits, magic explosions, auras

## Architecture

```
Theme (style definition + trained LoRA)
  └── Assets (characters, UI, items, effects)
       └── Variants (poses, states, animation frames)
```

For Hero Legends specifically:
```
Theme: "Hero Legends Chibi/Pixel"
  └── Race Template: "Orc"
       └── Job Template: "Warrior T1"
            └── Rarity Variants: Common → Legendary
                 └── Pose Variants: idle, attack, death
```

### Key Directories

```
src/
├── main/           # Electron main process
├── preload/        # IPC bridge (contextBridge)
├── renderer/       # React UI
│   └── src/
│       ├── components/
│       ├── styles/
│       └── types/  # Window type declarations
└── shared/         # Types and utilities shared between processes
    ├── types.ts    # Core domain types
    ├── sd-cpp.ts   # AI binary management
    └── sd-models.ts # Model catalog
```

### Data Flow

1. User creates a **Theme** with reference images and style prompts
2. Theme can optionally train a **LoRA** for precise style consistency
3. User defines **Templates** (race, job) that inject into prompts
4. User generates **Assets** using theme + templates
5. Each asset can have **Variants** (poses, states, frames)
6. ControlNet ensures structural consistency across variants

## Tech Stack

- **Electron** + **Vite** + **React** + **TypeScript**
- **sd-cpp** for native Stable Diffusion inference
- **better-sqlite3** for queue and history (requires `@electron/rebuild`)
- **JSON files** for themes and templates (portable, version-controllable)
- Models: SDXL-based (DreamShaper XL, Pixel Art XL)

## Consistency Strategy

Three-layer approach for visual consistency:

1. **Theme LoRA** - Captures overall art style (trained from 10-20 reference images)
2. **Asset Seed Lock** - Same seed for asset variants ensures structural similarity
3. **ControlNet** - Explicit pose/structure control for precise positioning

For Hero Legends matrix:
- Train ONE LoRA for the entire game's style
- Use templates to vary race/job descriptors in prompts
- Keep seed consistent across rarity variants of same character

## Development Notes

### Path Aliases

Both `tsconfig.json` and `electron.vite.config.ts` define matching aliases:
- `@/*` → `src/*`
- `@main/*` → `src/main/*`
- `@renderer/*` → `src/renderer/src/*`
- `@shared/*` → `src/shared/*`

### Data Storage (V1)

```
~/.forgecraft/
├── themes/              # JSON files (portable)
├── templates/           # JSON files (portable)
├── models/              # SD models
├── output/              # Generated images
│   └── {theme}/{template}/{vars}/{seed}.png
└── forgecraft.db        # SQLite (queue + history)
```

### Model Management

- Model IDs are used in code (e.g., `"dreamshaper-xl"`)
- `resolveModelPath()` handles ID → filename → full path resolution
- All models stored in `~/.forgecraft/models/`

### IPC Pattern

```typescript
// Main process (handler)
ipcMain.handle("channel:name", async (_event: IpcMainInvokeEvent, options: OptionType) => {});

// Preload (bridge)
channelName: (options: OptionType): Promise<ResultType> =>
  ipcRenderer.invoke("channel:name", options);

// Renderer (usage)
const result = await window.forge.channel.name(options);
```

### Queue Architecture (Phase 2)

Two-layer design for testability:

1. **queue-processor.ts** - Core processing logic (no Electron deps)
   - Polling loop with `setTimeout`
   - Callbacks for status/progress/complete/failed/diskFull
   - Testable in isolation with mocked `generateImage`

2. **queue-service.ts** - IPC bridge (Electron-aware)
   - Wraps processor with IPC broadcasting
   - `BrowserWindow.getAllWindows()` for multi-window support
   - Commands: add/cancel/retry/list/getStatus

**Key patterns:**
- `processing` flag prevents concurrent generation
- Disk full detection (ENOSPC code + message matching)
- Auto-pause on disk full, manual resume
- Retry resets item to pending status

### Generation Parameters

| Parameter | Default | Notes |
|-----------|---------|-------|
| width/height | 512 | For sprites; 1024 for full illustrations |
| steps | 20 | Balance of speed/quality for M3 Pro |
| cfgScale | 7 | Standard prompt adherence |
| loraWeight | 0.8 | Typical theme strength |
| controlStrength | 0.7 | Balance control vs creativity |

## Known Issues

### Fixed (from bootstrap review)
- [x] Window type declaration for `window.forge`
- [x] Type duplication between preload and shared
- [x] Model ID vs filename inconsistency
- [x] Typed IPC handler parameters
- [x] SetupWizard useEffect dependencies
- [x] Path aliases aligned

### Remaining
- [ ] Implement V1 workflow (see `docs/plans/2025-01-18-v1-workflow-design.md`)

### V1 Implementation Phases

1. **Phase 1: Core Infrastructure** ✅ - SQLite, Theme/Template CRUD, output folders (119 tests)
2. **Phase 2: Queue & Generation** ✅ - Queue processor, IPC progress, error recovery (179 tests)
3. **Phase 3: Basic UI** - Workflow views, raw prompt generation
4. **Phase 4: Template System** - Variable dropdowns, "Generate All"
5. **Phase 5: History & Polish** - Filters, queue management, settings

### Deferred to V2
- [ ] LoRA training pipeline
- [ ] Reference images for themes
- [ ] ControlNet pose editor
- [ ] IP-Adapter for reference-based generation
- [ ] Asset tagging and search

## Workflow Commands

```bash
# Development
npm run dev

# Build
npm run build

# Type check
npm run typecheck
```

## Related Projects

- **Vespyr** (`~/iv/vespyr`) - AI companion app, source of sd-cpp integration
- Binary release: `github.com/cesuygun/vespyr/releases/download/sd-cpp-v1/sd-darwin-arm64.tar.gz`

## Prompt Reference (Hero Legends)

See the Hero Legends GDD for full prompt templates. Key formula:
```
[Class], [race description], [armor/weapon details], [pose]
```

Example prompts:
- `Human paladin, radiant golden armor, divine sword, white cape, glowing halo, righteous pose`
- `Orc berserker, green skin, shirtless, massive war axe, rage veins, berserk stance`
- `Health bar, red fill, ornate frame, pixel art RPG style`
