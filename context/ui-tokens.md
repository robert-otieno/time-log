# Time Log — UI Tokens

This document describes the existing visual foundation and the semantic extensions required by Time Log. `app/globals.css` is the executable source of truth. When tokens change, update this document in the same feature.

## Token Strategy

The application uses Tailwind CSS v4 with shadcn preset `b311momZs0` (`radix-maia`, `mist`) and semantic CSS custom properties. Components use classes such as `bg-background`, `text-foreground`, and `border-border`, not hard-coded colors.

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}
```

The preset's accessible blue primary and cool mist neutral palette is canonical in both light and dark themes. Do not replace it as part of unrelated feature work.

## Existing Color Roles

| Role | Utility | Use |
| --- | --- | --- |
| Page | `bg-background text-foreground` | App background and default text |
| Card | `bg-card text-card-foreground` | Raised content surfaces |
| Primary | `bg-primary text-primary-foreground` | Main action and selected emphasis |
| Secondary | `bg-secondary text-secondary-foreground` | Lower-emphasis action |
| Muted | `bg-muted text-muted-foreground` | Subtle containers and metadata |
| Accent | `bg-accent text-accent-foreground` | Hover/selected supporting state |
| Destructive | `bg-destructive` | Destructive action/error emphasis |
| Border/input | `border-border`, `border-input` | Default separation and fields |
| Focus | `ring-ring` | Keyboard and validation focus |

## Semantic Status Extensions

Status badges use dedicated light/dark tokens. Their visible text and dot carry the same semantic tone, while the label ensures meaning never depends on color alone.

```css
--status-success: /* soft green surface */;
--status-success-foreground: /* accessible green text/dot */;
--status-warning: /* soft amber surface */;
--status-warning-foreground: /* accessible amber text/dot */;
--status-info: /* soft blue surface */;
--status-info-foreground: /* accessible blue text/dot */;
--status-blocked: /* soft red surface */;
--status-blocked-foreground: /* accessible red text/dot */;
--visibility-internal: ...;
--visibility-client: ...;
--timer-active: ...;
```

Do not encode project identity using unbounded arbitrary colors. If project color is introduced, use a curated accessible palette and persist a token key rather than a raw CSS value.

## Typography

The repository uses DM Sans for product copy, Outfit for heading utilities, and Geist Mono for timers and other fixed-width values through `next/font/google`.

| Role | Tailwind pattern | Notes |
| --- | --- | --- |
| Page title | `text-2xl font-semibold tracking-tight` | One per page |
| Section title | `text-base font-semibold` | Card/list section |
| Primary body | `text-sm` | Default product copy |
| Compact row | `text-sm leading-5` | Tasks and time entries |
| Metadata | `text-xs text-muted-foreground` | Timestamps, secondary labels |
| Numeric time | `font-mono tabular-nums` | Timer and durations |

The existing root `text-xs` class should be removed deliberately during shell modernization; do not compensate with scattered oversized text.

## Spacing

Use the Tailwind spacing scale consistently:

| Pattern | Value | Use |
| --- | --- | --- |
| Tight inline | `gap-1` / `gap-2` | Icons, badges, compact actions |
| Form controls | `gap-3` / `space-y-2` | Label, help, field |
| Card internals | `gap-4`, `p-4` or `p-6` | Standard sections |
| Page sections | `gap-6` | Major content groups |
| Shell gutters | `px-4 md:px-6` | Responsive page padding |

## Radius and Elevation

The preset base radius is `0.875rem` and derived shadcn radii are available.

- Inputs and buttons: `rounded-md`
- Cards, panels, dialogs: `rounded-lg` or `rounded-xl`
- Badges and avatars: `rounded-full`
- Prefer borders over heavy shadows. Use the established card shadow only when hierarchy needs elevation.

## Component Recipes

### Card

```text
bg-card text-card-foreground border border-border rounded-xl
```

### Focusable Row

```text
rounded-md border border-transparent hover:bg-muted/60
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
```

### Visibility Badge

- Always show an icon plus text: `Internal` or `Client visible`.
- Compact: `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium`.
- The editable control uses the same vocabulary; never use ambiguous labels such as “Public.”

### Timer

- Use `font-mono tabular-nums` for elapsed time.
- Active state includes a dot/icon and `Tracking` text in addition to color.
- Stop is visually prominent but not styled as destructive; stopping creates a valid record.

### Status and Priority

- Combine icon/label/color.
- Use `StatusBadge` for workflow, lifecycle, delivery, and outcome states. It provides a dot plus text with `success`, `warning`, `blocked`, `info`, and `neutral` tones.
- Map task status as: done → success; in progress → warning; blocked → blocked; to do → info; backlog → neutral.
- Map priority independently: urgent → blocked; high → warning; medium → info; low → neutral.
- Keep task status and priority visually distinct.
- Urgent may use destructive styling; incomplete or blocked states must not appear as validation errors.

## Motion

- Use short transitions for hover, sidebar, and reordering.
- Respect `prefers-reduced-motion`.
- Do not animate the timer every second beyond its text update.
- Never use pulsing as the only indicator of active work or overdue status.

## Token Invariants

- No raw hex, RGB, or OKLCH values in components.
- No direct Tailwind palette colors for product semantics.
- Light and dark themes ship together.
- Focus rings remain visible in every theme.
- Color is never the only carrier of meaning.
- Timer digits use tabular numerals to avoid layout shift.
