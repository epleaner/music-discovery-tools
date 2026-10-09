# Soundscape design system

## Overview

Hyper-minimal Japanese: warm charcoal, ivory, a restrained moss accent, open space,
and quiet rules. Music and actions carry the interface; no slogans, decorative
cards, gradients, shadows, or ornamental Japanese motifs.

The application remains Solid + Tailwind 3. The authorities are
[`tailwind.config.js`](tailwind.config.js),
[`globals.css`](src/styles/globals.css), and the repository-owned components.
Do not add another component library or a parallel visual vocabulary.

## Colors

Use semantic Tailwind tokens, never literal colors:

| Role                             | Utilities                                     |
| -------------------------------- | --------------------------------------------- |
| Canvas and quiet surfaces        | `bg-bg`, `bg-bg-subtle`, `bg-bg-muted`        |
| Primary and secondary text       | `text-fg`, `text-fg-muted`, `text-fg-subtle`  |
| Rules and interactive boundaries | `border-border`, `border-border-hover`        |
| Actions, selection and focus     | `text-accent`, `bg-accent`, `outline-accent`  |
| Operational state                | `text-danger`, `text-success`, `text-warning` |

Dark is the first-use default. Light and system preferences remain available and
persist through `useTheme`. System follows OS changes. Accent choices change only
accent tokens, not the neutral canvas, surfaces or body text. CSS values live
once in `globals.css`; never reproduce a theme palette in a component.

## Typography

System sans-serif for controls and data; `font-editorial` for the wordmark and
entity/page headings. No downloaded font is required. Base text is 14px, secondary
text 13px, with rem-based sizes so text enlargement remains possible. Use
`page-heading`, `entity-heading`, `section-title`, `list-title`, `list-meta`,
`result-title`, `result-meta`, and `numeric` rather than local font recipes.
Do not introduce a tiny metadata scale or CSS `zoom`.

## Layout

Use Tailwind's standard spacing and breakpoints for composition. Repeated anatomy
belongs in a named component recipe in `globals.css`, not repeated class strings.

- `app-header`, `workspace-tabs`, `filter-bar`: shared shell and navigation rhythm.
- `workspace-panel`, `panel-scroll`: panel ownership and desktop scrolling.
- `section-header`, `section-content`, `surface-section`: source/tool sections.
- `toolbar`, `control-group`, `form-stack`, `form-actions`: wrapping forms/actions.
- `list-row`, `list-select`, `list-main`, `list-actions`: all listening/artist rows.
- `result-row`, `result-main`, `result-actions`: source and lookup results.

Keep the persistent header to the wordmark and Account. Last.fm identity,
connection and appearance live together in the existing account menu. Submitting
identity or closing its connection dialog returns focus to Account.

Shell, navigation, list rows and section boundaries share one horizontal gutter:
`px-6`, increasing to `px-8` at `sm`. The boundary owns that gutter; nested result
rows and primary list buttons do not add another inset. Workspace/listening tabs
and the discovery heading share one full-height row rhythm, without vertical
padding on the row container, so sibling baselines and bottom rules align.
Section headers reserve one shared control-height row plus their vertical padding
and bottom rule, keeping metadata-only or loading headers aligned with actions.
Status messages inherit the boundary gutter rather than adding an inset callout.

Structural rules run edge-to-edge. The resize hit area overlays the single panel
boundary rather than reserving a blank column. Preserve native scrollbar sizing
and overlay behavior instead of forcing a fixed-width WebKit gutter. Result lists
cancel their section's gutter; result rows restore the shared content inset.

The listening/discovery split is resizable at `lg` and above, using pointer or
arrow/Home/End keys. Below `lg`, panels stack; the listening list stays bounded
and scrollable so discovery is reachable without traversing the entire history.
Sites, Scrape and NTS occupy the full workspace, without an empty discovery column.
NTS follows Scrape in the primary navigation; row lookup actions open it with the
artist/track preset. Its search stays mounted while switching workspace tabs.
Listening and result rows reflow by the panel's inline-size container, not the
window width.

Listening/discovery rows compose title, artist and time/count as inline,
baseline-aligned `list-main` fields from their incoming listing responses.
Use the shared compact artwork, row padding and gaps; do not force one line per
field or shrink the text scale. At `24rem` panel width, list actions share the row;
below that they reflow visibly. Result rows retain their `32rem` threshold.
Long data and enlarged text may wrap; preserve every field and action.
Rows do not perform extended-info lookups or load cached Last.fm metadata.

The desktop shell has a rem-based minimum height (`min-h-workspace`); short or
text-enlarged windows scroll the document rather than collapsing embedded views.
Discovery source sections size to their content under one panel scroll owner.
Discovery shows the current entity without breadcrumbs; URL-backed selection and
browser history remain intact.

Runtime inline styles are restricted to genuine data-dependent geometry: the
split percentage and virtualized genre height/offsets. Static arbitrary-value
utilities, literal colors, and per-screen visual overrides are not allowed.

## Elevation & Depth

No shadows or decorative elevation. Separate content with rules and spacing.
Account settings use `menu`; authentication/helper flows use native modal dialogs
with `dialog`, `dialog-header`, and `dialog-body`. The browser supplies background
inertness and modal focus behavior; dialog lifecycle code sets initial focus and
restores the trigger. Dialog headings/actions wrap at constrained widths; a
viewport-constrained dialog scrolls rather than clipping its actions. Buttons
stay within their owner and wrap compound labels when needed. Account menus
reserve a spacing-scale viewport gutter and scroll below the header when text is
enlarged.

The genre popup uses the positioner's available height, bounded by the shared
spacing scale; enlarged text scrolls inside the popup rather than off-screen.

## Shapes

Square artwork and badges; fields use a single bottom rule instead of a box.
Secondary buttons are text-like; reserve a filled accent for primary actions.
No pill shape for navigation or genre tags. `Artwork` owns Last.fm image
selection and generic-placeholder exclusion. Missing/failed artwork retains its
transparent footprint, not a decorative placeholder tile. Source covers use the
shared `result-cover` recipe.

## Components

| Component                     | Contract                                                                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                      | Canonical primary, secondary, control, icon, tab and link variants. Native button semantics; disabled state and visible keyboard focus.                                                     |
| `PanelTab`                    | A selected view/filter is an understated accent rule with `aria-pressed`; never a local selected-color recipe.                                                                              |
| `Input` / `Select`            | One field recipe; associated visible labels, native validation and standard focus treatment.                                                                                                |
| `Artwork`                     | Decorative thumbnail beside a named primary action; explicit dimensions, lazy loading, shared empty/error fallback.                                                                         |
| `Chip`                        | Quiet square label; genre removal is a separately named button.                                                                                                                             |
| `EmptyState` / `ErrorMessage` | Operational copy only; status/alert semantics and canonical state treatment.                                                                                                                |
| `ExternalLink`                | Accent link with safe external target; add the shared button variant class only for a button-shaped action.                                                                                 |
| `SourceLink`                  | Captured HTTP(S) metadata URL resolved against its source, composing `ExternalLink`; missing, malformed or non-web destinations stay readable text.                                         |
| `GenreSelect`                 | Ark multi-select semantics, grouped and measured virtual results, search, clear, removal and shuffle.                                                                                       |
| `LookupActions`               | Shared compact NTS/RYM row controls. Tracks use one artist-and-song query; artists use their name only. Matching link recipes, full accessible context and safe external RYM search.        |
| `MenubarInstall`              | One real download link and native installation disclosure shared by Connect and Browser helper; prerequisites, security guidance and configured-server launch instructions stay consistent. |

List primary actions are native buttons. NTS/RYM controls are siblings, never
nested buttons. Preserve source distinctions: RYM has ratings; Bandcamp has
playback/purchase/label exploration; NTS links externally. Minimize copy without
removing security or recovery guidance. Keep row actions visible. Discovery names
the selected artist once in its header.
Compound link actions align to the start when wrapped.

RYM and Bandcamp details link titles, artists, genres/tags, descriptors, tracks
and labels when their source provides a destination. Rating/review statistics
open the known release page; dates stay text. Never guess artist or genre slugs.
The menu-bar helper retains metadata URLs; refresh older cached results after
updating the helper to populate them.

Bandcamp track navigation and playback are separate sibling controls, never a
link inside a play button. Compose `list-row` and inline `list-main` metadata to
keep track name, availability and duration compact without forced line breaks.
The linked label name appears once alongside its exploration action.

## Do's and Don'ts

- Compose existing primitives and recipes before adding one. Add a new recipe
  only for a repeated semantic role, with its states and responsive behavior.
- Keep focus visible, label icon-only actions, retain disabled/loading/error
  states, and support reduced motion.
- Check populated, empty, loading, error, long-content and dialog states on the
  rendered surface, including 320px reflow and enlarged text.
- Do not hide functional controls to achieve minimalism, use display-only mock
  data in the application, duplicate style maps, or add arbitrary escape hatches.
