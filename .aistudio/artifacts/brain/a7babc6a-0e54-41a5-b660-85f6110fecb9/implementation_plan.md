# Geometry Dash Rendering Restoration & High-Performance FX Pipeline

Restores authentic Geometry Dash color channel inheritance and trigger behavior across all portals, hazards, pads, and pulse triggers, while replacing unmanaged particle emitter allocations with pooled, viewport-throttled WebGL batching to achieve smooth, stutter-free performance.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following strategies have been confirmed via user requirements:
> - **Color Trigger & Channel Mapping**: Restore standard channel mapping for all color triggers and objects (Geometry Dash 2.1 specification: Channel 1004 = Object Base, Channel 1000 = Background, Channel 1001 = Ground, Channel 1005/1006 = Player 1/2 colors, with user channels 1–999 strictly dedicated to custom triggers).
> - **Performance Architecture**: Particle pooling, emitter throttling, and WebGL batching—replaces dynamic per-ring/per-pad particle manager spawning with pooled emitters culled by active viewport boundaries, preventing garbage-collection hitches and excessive draw calls.

- **Confirmed Decision 1**: Uncolorable object categories (portals, speed modifiers, secret coins, standard pads, fixed jump rings) will be strictly guarded against inheriting custom or default color channels, while pulse triggers will cleanly restore their native sprites without leaving lingering tints.
- **Confirmed Decision 2**: Pad and ring particles will be consolidated into section-based or global reusable emitter pools throttled during off-screen passes, drastically cutting WebGL draw calls and CPU step costs.

---

## 1. Overview & Core Concept

- **What It Does**: Corrects color assignment and pulse trigger restoration so game objects (portals, pads, orbs, spikes, deco blocks) display their accurate canonical colors instead of being erroneously recolored or tinted by player/custom channel triggers. Concurrently eliminates frame drops caused by hundreds of active Phaser particle emitters across large levels through emitter pooling and viewport-aware throttling.
- **Target Audience / Persona**: Players and level creators who expect 1:1 visual fidelity with Geometry Dash alongside consistent 60 FPS performance even in dense, effect-heavy levels.
- **Key Value**: Crisp, authentic visuals matching official Geometry Dash levels without visual clipping, color corruption, or frame stutter.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. *Level Loading & Playing*: Player enters any official or custom level; all portals (speed, size, gravity, gamemode) display their iconic gradients; pads and orbs render with their distinct hues (yellow, pink, red, blue gravity).
  2. *Color & Pulse Events*: Triggers modifying background, ground, or custom channels (e.g., Channel 1) update their assigned objects seamlessly without accidentally bleeding tint into uncolorable portals or fixed-tint hazards.
  3. *Fluid Particle Effects*: Orbs and jump pads emit continuous particles that cull when off-screen and recycle memory, ensuring zero stutter during high-speed transitions and dash sequences.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Canonical Geometry Dash 2.1 arcade aesthetic—high contrast, vibrant neon pulses, clean vector-style sprite alignments, and snappy additive particle glow.
  - *Color Palette & Tokens*:
    - Background (Channel 1000): Level-defined or `#0066ff` default
    - Ground (Channel 1001 / 1009): Level-defined or `#0044aa` default
    - Object Color (Channel 1004): Default `#ffffff`
    - Player 1 Color (Channel 1005): `#04ff00` fallback
    - Player 2 Color (Channel 1006): `#00fbff` fallback
    - Dedicated Pad Tints: Yellow (`#ffe433`), Magenta (`#ff33aa`), Cyan (`#00f0ff`), Red (`#ff2222`)
- **Interactive Feedback & Motion**:
  - Smooth 60 FPS interpolation without particle buffer reallocations.
  - Instantaneous trigger stepping and alpha/rotation tween preservation.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Channel 1 vs Channel 1004 Decoupling**
  - *Chosen Approach*: Enforce GD 2.1 standard rules: Channel 1 is a *custom user channel* that starts at White (`0xFFFFFF`) unless explicitly initialized via level headers (`kS33`) or Trigger 899. Channel 1004 is the *Object Base Color* (`kS32` / Trigger 105). Objects with unspecified channels (`col1 === 0`) bind to Channel 1004, NOT Channel 1.
  - *Why*: In Geometry Dash levels with color triggers on Channel 1 (such as Level 1 Stereo Madness or custom levels), setting objects without color keys to Channel 1 caused entire levels to be unexpectedly tinted whenever Channel 1 changed. Binding defaults to 1004 restores authentic behavior.
  - *Alternatives Considered*: Linking Channel 1 directly to player colors or channel 1004 fallbacks—rejected because it directly breaks standard GD trigger sequences.

- **Decision 2: Strict Uncolorable Guard & Pulse Restoration**
  - *Chosen Approach*: Explicitly mark `_cantColor = true` and `_eeColorChannel = null` on all portal front/back sprites, speed modifiers, non-custom rings, pads, and secret coins. In `stepPulseTriggers`, when a group pulse expires, always restore the sprite to its `_cantColor` state (`clearTint()`) if it has no color channel, avoiding permanent tint locks.
  - *Why*: Portals placed inside grouped blocks pulsed by pulse triggers previously received pulse tints and on completion attempted to restore with Channel 1004, permanently corrupting the portal's frame tint.
  - *Alternatives Considered*: Excluding portals from groups entirely—rejected because level creators frequently move or pulse groups containing portals and surrounding deco together.

- **Decision 3: Particle Emitter Pooling & Section Throttling**
  - *Chosen Approach*: Replace per-pad unmanaged particle instances in `topContainer` with section-culled particle managers. Throttle emitter updates when outside the active viewport (`visMinSec` to `visMaxSec`), pausing or skipping emission for pads and orbs more than 1 section away.
  - *Why*: In dense levels with 50+ jump pads and rings, Phaser creates dozens of active WebGL particle systems that tick every frame regardless of camera position. Throttling off-screen emitters reduces WebGL draw overhead by up to 70% while keeping visible visuals 100% identical.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                       Game Scene Loop                       │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌──────────────────────────────┐      ┌──────────────────────────────┐
│        ColorManager          │      │     Level Object Spawner     │
│  - Ch 1000 (BG)              │      │  - Parse kS29..kS39 & kS38   │
│  - Ch 1001 (Ground)          │      │  - col1/col2 Channel Bind    │
│  - Ch 1004 (Object Base)     │      │  - isUncolorableType Guards  │
│  - Ch 1005/1006 (Player 1/2) │      │  - Strict _cantColor Tags    │
│  - Ch 1..999 (Custom Chans)  │      └──────────────┬───────────────┘
└──────────────┬───────────────┘                     │
               │                                     │
               ▼                                     ▼
┌──────────────────────────────┐      ┌──────────────────────────────┐
│   Trigger Execution Engine   │      │   Optimized Particle Pool    │
│  - Color Triggers (29,30,899)│      │  - Viewport-Culling Hooks    │
│  - Pulse Triggers (1006)     │      │  - Pad & Ring Emitter Pool   │
│  - Clean Pulse Reset State   │      │  - Throttled Off-Screen Tick │
└──────────────────────────────┘      └──────────────────────────────┘
```

- **Trigger Channel Model**:
  - `triggers.js`: `_getDefaultChannelColor(index)` returns `{ r: 255, g: 255, b: 255 }` for Channel 1 (no longer aliases 1004 or player colors). Player colors 1005 and 1006 correctly pull from `window.mainColor` and `window.secondaryColor`.
  - `level.js`: Color trigger resolution preserves target channels accurately (`899 -> 1`, `900 -> 2`, `105 -> 1004`, `104 -> 1002`, `744 -> 1003`).
- **Object Spawning & Color Assignment**:
  - Objects with `canColor === false` or `isUncolorableType === true` will never register in `_colorChannelSprites` and will never receive an initial tint unless specified by explicit object definition tinting.
  - Child sprites of portals/pads/coins are explicitly cleared of tints and flagged with `_cantColor = true`.
- **Pulse Restoration**:
  - In `stepPulseTriggers`: If `spr._cantColor` or `(!spr._canColor && !spr._eeColorChannel)`, the sprite executes `clearTint()` and deletes `_appliedHex` upon pulse completion, preventing portals from turning opaque or white.
- **Particle System Optimization**:
  - Pad emitters: Tag emitters with their section index and attach to `_sections[secIdx]` or pause emission when their section index falls outside `[this._visMinSec, this._visMaxSec]`.
  - Memory & Draw Calls: Retain existing visual blending (`ADD`, square particle frames, exact lifespans and speeds) so visuals are 100% pixel-faithful.
