# BIOWESS 2026 — Design System Blueprint

> Version 1.0 | For incremental implementation by coding agents.
> All specifications here are the single source of truth for visual decisions.

---

## 1. Aesthetic Direction

**Concept:** *Clinical Cinematic* — the aesthetic of a high-spec surgical instrument fused with an editorial medical journal. Dark, precise, purposeful. Not a dashboard. A _lens_.

**Adjectives that must describe every screen:** authoritative · quiet · luminous · precise · cold.

**Anti-patterns to avoid absolutely:**
- Purple gradients on white
- Generic card shadows with `box-shadow: 0 2px 8px rgba(0,0,0,0.1)`
- Rounded-corner-everything (only specific components are pill-shaped)
- Emoji, casual icons, decorative illustrations
- Bright neon palettes
- Overcrowded sidebars

---

## 2. Color System

All colors defined as CSS custom properties on `:root`.

```css
:root {
  /* Core backgrounds — layered darkness */
  --bg-void:       #080809;   /* outermost shell, body */
  --bg-base:       #0D0D0F;   /* primary surface */
  --bg-surface:    #131316;   /* card / panel background */
  --bg-elevated:   #1A1A1E;   /* elevated cards, hover states */
  --bg-glass:      rgba(20, 20, 24, 0.65);   /* glassmorphism panels */

  /* Borders */
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-dim:    rgba(255, 255, 255, 0.10);
  --border-bright: rgba(255, 255, 255, 0.18);

  /* Brand / accent — crimson blood */
  --accent:        #C0272D;   /* primary CTA, active states */
  --accent-dim:    #8B1C21;   /* hover, pressed */
  --accent-glow:   rgba(192, 39, 45, 0.22);  /* soft glow halos */
  --accent-ultra:  rgba(192, 39, 45, 0.08);  /* very faint tint areas */

  /* Text hierarchy */
  --text-primary:  #F2F2F5;
  --text-secondary:#9999A8;
  --text-muted:    #55555F;
  --text-inverse:  #080809;

  /* Semantic status */
  --status-ok:     #22C55E;
  --status-warn:   #F59E0B;
  --status-error:  #EF4444;
  --status-info:   #3B82F6;

  /* Glass blur values */
  --blur-sm:  8px;
  --blur-md:  16px;
  --blur-lg:  28px;

  /* Glow radii */
  --glow-accent: 0 0 24px var(--accent-glow);
  --glow-subtle: 0 0 40px rgba(192, 39, 45, 0.10);
}
```

---

## 3. Typography

**Import in index.html (Google Fonts):**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=JetBrains+Mono:wght@400;500&family=Syne:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

| Role | Font | Weight | Size | Usage |
|---|---|---|---|---|
| Display / Logo | DM Serif Display | 400 | 32–48px | Splash, hero headers |
| UI headings | Syne | 700–800 | 14–24px | Section titles, module names |
| Body / Labels | Syne | 400–500 | 12–14px | Descriptions, form labels |
| Code / Data | JetBrains Mono | 400–500 | 11–13px | Lab values, report markdown, IDs |
| Micro-labels | Syne | 500 | 10–11px uppercase letter-spacing 0.12em | Status pills, category tags |

**CSS variables:**
```css
:root {
  --font-display: 'DM Serif Display', serif;
  --font-ui:      'Syne', sans-serif;
  --font-mono:    'JetBrains Mono', monospace;
}
```

**Markdown report typography:**
All AI-generated markdown reports use `--font-mono` for data values and `--font-ui` for prose. Never use `Inter` or `Roboto` anywhere.

---

## 4. Spacing Scale

```css
:root {
  --space-1:   4px;
  --space-2:   8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
}
```

**Layout grid:** 12 columns, `gap: var(--space-6)`, max-width 1440px.

---

## 5. Component Library

### 5.1 Glassmorphism Panel (`.glass-panel`)
```css
.glass-panel {
  background: var(--bg-glass);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.35), var(--glow-subtle);
}
```

### 5.2 Elevated Card (`.card`)
```css
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: var(--space-6);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.card:hover {
  border-color: var(--border-dim);
  box-shadow: var(--glow-subtle);
}
```
Cards have a **4px top accent bar** using `::before` with `background: var(--accent)` for module identity.

### 5.3 Pill Button (`.btn-pill`)
```css
.btn-pill {
  font-family: var(--font-ui);
  font-weight: 600;
  font-size: 13px;
  padding: 9px 22px;
  border-radius: 999px;     /* pill shape — always full round */
  border: none;
  cursor: pointer;
  transition: all 0.18s ease;
  letter-spacing: 0.02em;
}
.btn-pill-primary {
  background: var(--accent);
  color: #fff;
  box-shadow: 0 0 0 0 var(--accent-glow);
}
.btn-pill-primary:hover {
  background: var(--accent-dim);
  box-shadow: var(--glow-accent);
  transform: translateY(-1px);
}
.btn-pill-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-dim);
}
.btn-pill-ghost:hover {
  color: var(--text-primary);
  border-color: var(--border-bright);
  background: var(--bg-elevated);
}
```

### 5.4 Form Input (`.input-field`)
```css
.input-field {
  font-family: var(--font-mono);
  font-size: 13px;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  color: var(--text-primary);
  padding: 9px 12px;
  width: 100%;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.input-field:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-ultra);
}
.input-field::placeholder {
  color: var(--text-muted);
}
```

### 5.5 Status Pill (`.status-pill`)
```css
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 3px 10px;
  border-radius: 999px;
  font-family: var(--font-ui);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.10em;
  text-transform: uppercase;
}
.status-pill-ok    { background: rgba(34,197,94,0.12);  color: var(--status-ok); }
.status-pill-warn  { background: rgba(245,158,11,0.12); color: var(--status-warn); }
.status-pill-error { background: rgba(239,68,68,0.12);  color: var(--status-error); }
.status-pill-info  { background: rgba(59,130,246,0.12); color: var(--status-info); }
```

### 5.6 Toast Notification System
Toasts appear in the **bottom-right corner**. Managed via a global `ToastContext`.
```
Position: fixed, bottom: 24px, right: 24px
Stack direction: bottom-to-top (newest on top)
Max visible: 4
Auto-dismiss: 4000ms
Width: 320px max
Radius: 10px
Font: --font-ui, 13px
```
Toast types: `success` · `error` · `warning` · `info`

Each toast has:
- Left accent border (4px, color matching type)
- Icon (Lucide) + message text
- Optional dismiss `×` button
- Framer Motion: slide in from right + fade, slide out to right on dismiss

### 5.7 Loading Line Animation (`.loading-line`)
```css
.loading-line {
  height: 2px;
  width: 100%;
  background: var(--border-subtle);
  border-radius: 999px;
  overflow: hidden;
}
.loading-line::after {
  content: '';
  display: block;
  height: 100%;
  width: 40%;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  animation: shimmer 1.4s ease-in-out infinite;
}
@keyframes shimmer {
  0%   { transform: translateX(-150%); }
  100% { transform: translateX(350%); }
}
```

### 5.8 Sidebar Navigation
```
Width: 220px (desktop), collapsible to 0 on mobile
Background: var(--bg-base)
Border-right: 1px solid var(--border-subtle)
Active link: left 3px border var(--accent), background var(--bg-elevated)
Inactive: color var(--text-muted), hover color var(--text-primary)
Logo slot at top: 48px height
Bottom slot: Settings link
```

---

## 6. Motion System (Framer Motion)

**Install:** `framer-motion` must be added to `package.json`.

### Named Variants

```js
// variants.js — shared across all pages
export const fadeIn = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } }
};

export const slideInRight = {
  hidden:  { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } }
};

export const staggerChildren = {
  visible: { transition: { staggerChildren: 0.08 } }
};

export const scaleIn = {
  hidden:  { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } }
};

// Page transition wrapper
export const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -6 },
  transition: { duration: 0.28, ease: 'easeOut' }
};
```

### Rule Table

| Trigger | Variant | Duration |
|---|---|---|
| Page mount | `fadeIn` | 350ms |
| Card stagger | `staggerChildren` + `scaleIn` | 80ms stagger |
| Toast appear | `slideInRight` | 300ms |
| Toast dismiss | fade out + translateX(40px) | 200ms |
| Modal open | `scaleIn` | 300ms |
| Report panel appear | `slideInRight` | 300ms |
| Sidebar links | `fadeIn` on mount | 120ms stagger |
| Splash fade-in | custom (see §8) | 2500ms total |

---

## 7. Icon System

**Only Lucide React icons.** No other icon library, no emoji, no SVG sprites.

**Install:** `lucide-react` must be added to `package.json`.

Module-to-icon mapping:
| Module | Icon |
|---|---|
| CBC Interpreter | `Droplets` |
| Coagulation | `Activity` |
| ROTEM | `Waves` |
| Casebook | `BookOpen` |
| Chat | `MessageSquare` |
| Settings | `Settings` |
| Export PDF | `FileDown` |
| Copy | `Copy` |
| Bookmark | `Bookmark` / `BookmarkCheck` |
| Delete | `Trash2` |
| New session | `Plus` |
| Search | `Search` |
| Warning | `AlertTriangle` |
| Error | `XCircle` |
| Success | `CheckCircle2` |
| Info | `Info` |
| Edit | `Pencil` |
| Close | `X` |

Icon size standard: `16px` inline, `20px` hero/standalone.

---

## 8. Splash Screen

**Component:** `<SplashScreen onComplete={fn} />`

**Sequence (total ~2.5s):**
1. **0ms** — Background fades in (`--bg-void`)
2. **200ms** — Logo PNG fades in (opacity 0→1, scale 0.92→1.0, duration 800ms, ease spring)
3. **1000ms** — Text "BIOWESS 2026 ©" fades in below logo (opacity 0→1, 400ms)
4. **1600ms** — Loading line animation starts (shimmer, 600ms)
5. **2400ms** — Entire splash fades out (opacity 1→0, 300ms)
6. **2700ms** — `onComplete()` called, main app appears

**Layout:**
```
position: fixed, inset: 0, z-index: 9999
display: flex, flex-direction: column, align-items: center, justify-content: center
gap: 24px
```

**Logo:** `<img src="/logo.png" alt="BIOWESS" style="width: 80px; height: 80px; object-fit: contain;" />`  
Use `/public/logo.png` as placeholder (white PNG or SVG with "BW" monogram).

**Text styling:**
```css
font-family: var(--font-display);
font-size: 22px;
color: var(--text-secondary);
letter-spacing: 0.08em;
```

---

## 9. Dashboard / HomePage Layout

**Two-part layout:**
1. **Hero header:** Full-width, left-aligned. Title: `Clinical Analysis Launcher` (Syne 700, 26px). Subtitle: 13px muted text.
2. **Module cards grid:** 3 columns desktop, 1 column mobile, `gap: var(--space-6)`.

**Module card specs:**
- Background: `var(--bg-surface)`
- Top accent bar: 3px, `var(--accent)`
- Icon: 28px Lucide icon, color `var(--accent)`, inside a `40×40` circle with `var(--accent-ultra)` background
- Title: Syne 700, 15px, `var(--text-primary)`
- Description: 12px, `var(--text-muted)`, line-height 1.7
- CTA button: `.btn-pill-primary`
- Hover: card border brightens, subtle glow

**Toast on app start:** fire `success` toast → `"Gemini API connected"` if key configured. Remove all persistent status indicators from homepage.

---

## 10. Module Page Layout (CBC / Coag / ROTEM)

**Desktop (≥ 1024px):**
```
┌──────────────────┬─────────────────────────┐
│  Input Panel     │  AI Output Panel        │
│  (380px fixed)   │  (flex-grow)            │
│                  │                         │
│  Glass panel     │  Glass panel            │
│  Form fields     │  Editable markdown      │
│  CTA button      │  Toolbar (copy, export) │
└──────────────────┴─────────────────────────┘
```

**Mobile (< 1024px):**
- Single column
- Input form shown first
- After generation, form scrolls up, report slides in below
- Report replaces form view (form toggled via back button)

**Input panel:**
- Title: module name + icon
- Form fields: `.input-field`, labeled with `--font-ui`, monospace values
- Checkbox/boolean flags: custom pill toggles
- Submit button: `.btn-pill-primary`, full width, with spinner when loading
- Validation warnings: amber `.status-pill` banners above submit

**AI Output panel:**
- Appears with `slideInRight` animation
- Content: editable `contenteditable` div or textarea styled as markdown
- Toolbar (sticky at top of panel):
  - Copy to clipboard (`Copy` icon, ghost pill button)
  - Export PDF (`FileDown` icon, ghost pill button)
  - Save to Casebook (`BookOpen` icon, ghost pill button)
- Footer: grounding source tag (e.g. `local: cbc_guidelines.md`)

---

## 11. Chat Page Layout

**Three-column layout (desktop):**
```
┌──────────┬────────────────────────┬──────────┐
│ Sessions │  Chat Thread           │ (future) │
│  panel   │  + Input bar           │          │
│  (200px) │  (flex-grow)           │          │
└──────────┴────────────────────────┴──────────┘
```

**Session panel:**
- New Session button: `.btn-pill-primary` full width
- Session list: clickable items, active = `var(--bg-elevated)` + left accent border
- Rename on double-click
- Delete: `Trash2` icon, appears on hover

**Chat thread:**
- User messages: right-aligned, pill bubble, `var(--bg-elevated)`, `--font-ui` 13px
- Assistant messages: left-aligned, no bubble — rendered as markdown directly on background
- Streaming indicator: 3-dot pulse animation while waiting
- Scroll to bottom on new message
- Copy button on each AI message (appears on hover)

**Input bar:**
- Multi-line textarea, auto-resize
- Attach report: `Paperclip` icon → dropdown of casebook reports
- Send: `.btn-pill-primary` or `Enter` key

---

## 12. Casebook Page Layout

**Toolbar row:** Search input (full width, `.input-field`) + filter pills (All / CBC / Coag / ROTEM / Bookmarked).

**Report grid:** 2-column desktop, 1-column mobile.

**Report card:**
- Module type pill (top-right)
- Title: Syne 600, 14px
- Date: 11px muted mono
- Bookmark icon toggle
- Click → navigate to `/casebook/:reportId`

**Multi-select mode:** checkbox on hover, bulk action bar appears at bottom (delete selected, export selected).

---

## 13. Report Viewer Page (`/casebook/:reportId`)

**Layout:**
```
┌───────────────────────────────────────────┐
│  Back arrow | Report title (editable)     │
│  Meta: module type · date · input params  │
├───────────────────────────────────────────┤
│  Toolbar: Copy · PDF · Markdown · Inject  │
├───────────────────────────────────────────┤
│  Editable markdown report body            │
│  (contenteditable div, styled)            │
└───────────────────────────────────────────┘
```

**Inject into Chat:** opens new chat session pre-loaded with the report as attached context.

---

## 14. Settings Page

**Sections:**
1. **API Key** — masked input, save/test button, status pill
2. **Corpus Status** — table showing cbc/coag/rotem .md file, availability, size in bytes
3. **Theme** — placeholder (dark only for now)
4. **Danger Zone** — clear all reports, clear all chat sessions (with confirmation modal)

---

## 15. Responsive Breakpoints

```css
/* Mobile first */
/* sm */  @media (min-width: 640px)  { ... }
/* md */  @media (min-width: 768px)  { ... }
/* lg */  @media (min-width: 1024px) { ... }  /* main layout breakpoint */
/* xl */  @media (min-width: 1280px) { ... }
/* 2xl */ @media (min-width: 1536px) { ... }
```

---

## 16. Global CSS Reset & Base Styles

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { scroll-behavior: smooth; }

body {
  background-color: var(--bg-void);
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}

/* Scrollbar styling */
::-webkit-scrollbar        { width: 6px; height: 6px; }
::-webkit-scrollbar-track  { background: transparent; }
::-webkit-scrollbar-thumb  { background: var(--border-dim); border-radius: 999px; }
::-webkit-scrollbar-thumb:hover { background: var(--border-bright); }

/* Selection */
::selection { background: var(--accent-glow); color: var(--text-primary); }
```

---

## 17. AI Output / Markdown Styling

All AI-generated report content is rendered inside `.report-body`:

```css
.report-body {
  font-family: var(--font-ui);
  font-size: 13.5px;
  line-height: 1.75;
  color: var(--text-primary);
}
.report-body h2 {
  font-family: var(--font-ui);
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: var(--accent);
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: var(--space-2);
  margin: var(--space-6) 0 var(--space-3);
}
.report-body h3 {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin: var(--space-4) 0 var(--space-2);
}
.report-body p  { margin-bottom: var(--space-3); }
.report-body ul { padding-left: var(--space-5); margin-bottom: var(--space-3); }
.report-body li { margin-bottom: var(--space-1); }
.report-body code {
  font-family: var(--font-mono);
  font-size: 12px;
  background: var(--bg-elevated);
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--accent);
}
.report-body strong { color: var(--text-primary); font-weight: 700; }
```

---

## 18. Tailwind Config Alignment

The Tailwind config should extend with the BIOWESS palette so utility classes match design tokens:

```js
// tailwind.config.js (extend section)
extend: {
  colors: {
    void:    '#080809',
    base:    '#0D0D0F',
    surface: '#131316',
    accent:  '#C0272D',
    'accent-dim': '#8B1C21',
  },
  fontFamily: {
    display: ['DM Serif Display', 'serif'],
    ui:      ['Syne', 'sans-serif'],
    mono:    ['JetBrains Mono', 'monospace'],
  },
  borderRadius: {
    pill: '999px',
  }
}
```

---

*End of design.md — BIOWESS 2026 Design System v1.0*
