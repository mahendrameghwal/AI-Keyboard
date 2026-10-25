---
name: Apple Photography-First
version: 1.0.0
description: Design tokens and visual language specification for AI Keyboard.
colors:
  primary: "#0066CC"
  primary-focus: "#0071E3"
  primary-dark: "#2997FF"
  ink: "#1D1D1F"
  white: "#FFFFFF"
  parchment: "#F5F5F7"
  pearl: "#FAFAFC"
  dark-1: "#272729"
  dark-2: "#2A2A2C"
  dark-3: "#252527"
  text-muted: "#7A7A7A"
  text-on-dark: "#FFFFFF"
  text-muted-dark: "#CCCCCC"
  border: "#E0E0E0"
  divider: "#F0F0F0"
  black: "#000000"
typography:
  font-family: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", system-ui, sans-serif'
  scale:
    hero:
      size: 56px
      weight: 600
      line-height: 1.07
    display-large:
      size: 40px
      weight: 600
      line-height: 1.10
    display-medium:
      size: 34px
      weight: 600
      line-height: 1.20
    lead:
      size: 28px
      weight: 400
      line-height: 1.14
    tagline:
      size: 21px
      weight: 600
      line-height: 1.19
    body:
      size: 17px
      weight: 400
      line-height: 1.47
    body-strong:
      size: 17px
      weight: 600
      line-height: 1.24
    caption:
      size: 14px
      weight: 400
      line-height: 1.43
    fine-print:
      size: 12px
      weight: 400
      line-height: 1.40
spacing:
  scale: [4px, 8px, 12px, 17px, 24px, 32px, 48px, 80px]
  section-desktop: 80px
  section-mobile: 48px
  card-padding: 24px
  gap-sm: 12px
  gap-md: 17px
  gap-lg: 24px
rounded:
  none: 0px
  xs: 5px
  sm: 8px
  md: 11px
  lg: 18px
  pill: 9999px
---

# AI Keyboard — Design Specification

## Overview
A premium, photography-first interface inspired by Apple's visual language.
Priority: Usability → visual consistency → visual polish.

### Core Principles
1. **Product-first presentation with minimal UI chrome.** Focus user attention on writing results and AI actions.
2. **Edge-to-edge sections with alternating light and dark surfaces.** White, parchment (`#F5F5F7`), and dark sections (`#272729`).
3. **Generous whitespace and strong typographic hierarchy.** Clear contrast between 40–56px headings and 17px body.
4. **Restrained color, borders, and elevation.** Action Blue (`#0066CC` on light, `#2997FF` on dark) is the only interactive accent.
5. **Functional simplicity over decorative complexity.** Surface colors separate sections instead of borders or heavy drop shadows.

## Colors
| Token | Hex | Role |
| :--- | :--- | :--- |
| `primary` | `#0066CC` | Primary action buttons and links on light surfaces |
| `primary-focus` | `#0071E3` | Input focus rings, pressed button states |
| `primary-dark` | `#2997FF` | Links and interactive text on dark surfaces |
| `ink` | `#1D1D1F` | Primary text and headings on light surfaces |
| `white` | `#FFFFFF` | Main canvas, card fills |
| `parchment` | `#F5F5F7` | Alternate background surfaces, secondary containers |
| `pearl` | `#FAFAFC` | Subtle control surfaces and chip backgrounds |
| `dark-1` | `#272729` | Dark feature sections and high-contrast callouts |
| `dark-2` | `#2A2A2C` | Alternate dark surfaces |
| `dark-3` | `#252527` | Deep dark accents and footer |
| `text-muted` | `#7A7A7A` | Secondary descriptions, timestamps, metadata |
| `text-on-dark` | `#FFFFFF` | Headings and text on dark surfaces |
| `text-muted-dark` | `#CCCCCC` | Subtext on dark surfaces |
| `border` | `#E0E0E0` | Hairline borders on light surfaces |
| `divider` | `#F0F0F0` | Row separators in settings tables |
| `black` | `#000000` | Global navigation chrome |

## Typography
Use system SF Pro font stack across platforms.
- Display styles use weight 600 with tight line heights (1.07 to 1.20) and subtle negative letter spacing.
- Body text remains at 17px with comfortable line spacing (1.47).
- Weight 400 for reading content, 600 for emphasis.

## Layout & Spacing
Spacing scale: `4px` · `8px` · `12px` · `17px` · `24px` · `32px` · `48px` · `80px`.
- Section vertical padding: `48px` on mobile, `80px` on desktop.
- Card padding: `24px`.
- Component gaps: `12px` to `24px`.
- Generous whitespace around input cards and preview surfaces.

## Shapes & Elevation
- `none` (`0px`): Full-width background sections.
- `xs` (`5px`): Tiny indicators.
- `sm` (`8px`): Utility badges and small tags.
- `md` (`11px`): Input fields and secondary capsules.
- `lg` (`18px`): Main cards, grouped inset tables, preview containers.
- `pill` (`9999px`): Action buttons, segmented controls, status chips.

## Do's and Don'ts
- **DO** use surface background contrast (`parchment` vs `white` vs `dark-1`) to delineate sections.
- **DO** use `#2997FF` for links on dark surfaces, never on light surfaces.
- **DO** keep action buttons shaped as rounded pills (`9999px`).
- **DON'T** introduce rainbow accents (red, green, orange, purple) for non-critical elements.
- **DON'T** add heavy drop shadows; Apple's modern language uses flat surfaces with hairline boundaries.
