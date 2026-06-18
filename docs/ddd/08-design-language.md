# 08 — Design Language & Visual System

<!-- version: 1.0.0 -->
<!-- classification: DESIGN -->
<!-- date: 2026-06-18 -->
<!-- last-updated: 2026-06-18 -->

The visual + interaction vocabulary, derived from `theme.ts`, the panels, and the renderer
constraints. This is the section to evolve first in a redesign.

## Color roles (current — raw 256 indices)

| Token | 256 | Used for |
|---|---|---|
| `bg` | 232 | app background |
| `bgPanel` | 234 | panel fill |
| `bgActive` | 236 | selected row / focused element fill |
| `border` | 240 | unfocused panel border |
| `borderActive` | 75 | **focused** panel border (focus affordance) |
| `text` | 252 | primary text / assistant |
| `textDim` | 245 | secondary text / system |
| `textBright` | 255 | titles / emphasis |
| `accent` | 75 | primary action / user text / selection bg |
| `success` | 82 | done / chat-mode toggle |
| `warning` | 214 | warnings / WARN logs / countdowns |
| `error` | 196 | errors / danger actions |
| `info` | 117 | informational / output ports |

> Note `accent` and `borderActive` are the **same** blue (75). There is no separate "focus" vs
> "primary" token — a candidate for the semantic-token refactor (10).

## Status iconography

| Glyph | Meaning | Where |
|---|---|---|
| `○` | idle | blocks, agents, status |
| `●` | running / active | blocks, agents |
| `⏳` | running (Status set) | theme `Status` |
| `✓` | done | blocks, agents |
| `✗` | error | blocks, agents |
| `★` | active session | Agents list |
| `►` / `◄` `▼` | wire arrowheads / direction | canvas |
| `●` / `○` | input / output ports | canvas (accent / info) |
| `◂` / `▸` | horizontal-scroll edge markers | Session tables |
| `▲` / `▼` | more-content indicators | Config/lists |

**Accessibility note:** status is conveyed by **color + glyph** in most places, but several states
rely on color alone (log levels, focus). A redesign should ensure shape/text redundancy.

## Structure & borders

- **Single-line box** (`Box`) = a **panel** region.
- **Double-line box** (`DBox`) = a **canvas node** (agent block) — visually distinguishes
  "structural panel" from "content node."
- **Focus affordance** = border switches `border → borderActive` (240 → 75) + bold title. This is
  the *only* focus cue; there is no focus ring, underline, or background change standard across
  panels.

## Overlays & modals

Centered bordered boxes drawn last (on top). Current overlays: Command Palette, Session model
picker, Session new-session menu, Config edit/login/import modals. **Each is hand-implemented**
(border + centering + click-outside-to-close) with **hard-coded dimensions** (widths 46/56/58/64,
heights 10/11/8). Dismiss: Esc and/or click-outside — *inconsistently* (ContextMenu has neither).
→ Consolidation candidate (10).

## Cell & glyph constraints (the hard rules)

- **One UTF-16 code unit per cell.** Multi-codepoint glyphs (emoji with ZWJ/variation selectors)
  break alignment. SessionPanel **sanitizes emoji → ASCII** (`EMOJI_ASCII` map) before display.
- **Wide characters** (CJK/emoji, width 2) are only handled inside `VTScreen` (the terminal panel),
  not in the general renderer — avoid them elsewhere.
- **Truecolor** is supported (`[r,g,b]`) but the palette is 256-index by default.
- **OSC 8 hyperlinks** are supported per-cell (e.g. clickable token URLs in Config).
- **OSC 52** is used for clipboard copy (selection → clipboard without a system call).

## Typography & emphasis

The only "type styles" available are cell attributes: **bold**, **dim**, **underline**, **reverse**.
Current usage: bold = titles/selection/active; dim = secondary/disabled; reverse = text selection
highlight. There is no documented scale or rules for when to use which — emphasis is ad hoc.

## Density & layout language

- Fixed ratio splits (40% session, 70/30 right column). No adjustable dividers, no breakpoints.
- Lists use a `► ` selection prefix + `bgActive` fill; headers in accent/bold.
- Hint bars (bottom of Config/Logs/Session) document keys inline — but the wording/format differs
  per panel.

## Open Design Questions

1. **Semantic tokens:** introduce roles (`--focus`, `--primary`, `--danger`, `--muted`, `--surface`,
   `--surface-raised`) mapping to palette values, enabling theme swaps + high-contrast? (Today
   `accent` == `borderActive`, conflating primary and focus.)
2. **Focus affordance:** is the border-color swap enough, or adopt a consistent focus indicator
   (ring/underline/badge) across all panels and overlays?
3. **Iconography redundancy:** standardize a status vocabulary that always pairs glyph + color
   (and optional text) for accessibility?
4. **Typography scale:** define explicit rules for bold/dim/underline/reverse (an emphasis ladder)?
5. **Modal system:** one canonical overlay (size tiers, header, footer hints, dismiss rules)?
6. **Density modes:** a compact vs comfortable mode for small terminals?
