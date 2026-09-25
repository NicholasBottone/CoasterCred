# CoasterCred design system

**Modern amusement-park wayfinding meets an enthusiast’s ride logbook.** Use park information boards, ride placards, and trip journals as the filter. Keep social warmth and coaster personality; do not strip away character.

## Foundations

- Use the mixed-case **CoasterCred** wordmark, coaster logo, readable sans-serif titles/body, and compact monospaced signage labels and measurements. Uppercase belongs to labels, not every heading.
- Indigo/periwinkle marks interactions, active navigation, date numbers, focus, and track art. Keep large surfaces neutral. Avoid gradients, generic purple panels, and decorative pill collections.
- Maintain readable text and clear hierarchy; gain density through spacing, not smaller type. Use a 4/8/12/16/24/32px spacing scale, 1px rules, 6px container corners, and 4px control corners.

Semantic tokens live in `src/index.css`; Tailwind’s primary color uses the shared brand token:

| Role                | Light                 | Dark                  |
| ------------------- | --------------------- | --------------------- |
| Brand / interaction | `#5B50CF`             | `#B2A7FF`             |
| Page / surface      | `#F2F4F7` / `#FFFFFF` | `#111720` / `#19212D` |
| Text / secondary    | `#1B2432` / `#5D6A7C` | `#EEF2F8` / `#AAB6C7` |
| Divider             | `#D7DDE6`             | `#344051`             |
| Wood                | `#8B5D18`             | `#D7B36E`             |
| Steel               | `#16718F`             | `#73C7E6`             |
| Hybrid              | `#A14788`             | `#DDA0CF`             |

Taxonomy uses 11px medium-weight **text only**: cyan Steel, amber Wood, orchid Hybrid. No pills. The coaster name wins hierarchy; category names keep color supplementary.

## Signature components

- **Rating circle:** preserve the 1–10 number, circular shape, green/yellow/red meaning, personal-rating association, and consistent visual rhythm. Retain existing score semantics and the 2px border; never replace with a generic badge or recolor with brand indigo.
- **Visit ticket:** one container per trip, with a date rail, dashed perforation, and tiny edge notches. Keep park, participants, rides, and achievements together. No redundant “Park day” label or nested ride cards.
- **Profile summary:** `ProfileSummary` keeps “Current #1” secondary above a semibold (600), 18px coaster name.
- **Ride stats:** one coherent group containing the time picker, coaster/park/country counts, most repeated maker, and record rows. All respond to the same period. Separate records with rules, emphasize measurements, and retain units, averages, and totals. Lifetime summary and Recent Rides stay outside this filter scope. Small thin accent icons + muted technical uppercase labels are a signature pattern, reserved for metadata. Use tabular numerals for data; `record-value` reserves a shared unit column, even for unitless values.
- **Recent Rides:** unboxed; prominent heading, distinct date groups, semibold ride names, quieter park names.
- **Track motifs:** `TrackMotif.tsx` owns five handcrafted, unfilled Bézier SVGs: airtime (Profile), lift/drop (Feed), roll (My List), loop (Search), top hat (Rankings). Share stroke, scale, and restrained rail detail. One per major page; never imply a named ride’s geometry.
- **Social details:** keep profile photos, achievements, and reride indicators. Use one outlined icon system (Lucide); preserve achievement and reride icons rather than deleting them with the emojis.

## Layout and guardrails

- Desktop: 144px sidebar, thin vertical edge indicator, accent icon and medium-weight label; no selection box. Mobile: bottom navigation with accent icon/stronger label, no top rule or pill. Keep 44px touch targets and intentional stacking.
- Keep the profile introduction compact. Target 20–24px **total vertical padding** per mobile record row, without compressing labels or numbers.
- Containers express trips or shared control scope; typography, spacing, and rules handle internal hierarchy. Avoid nested stat tiles. Do not remove useful grouping to pursue minimalism.
- Reuse `VisitTicket`, `ProfileSummary`, `ProfileWrappedStats`, `RecentRides`, `ScoreBadge`, and shared tokens; avoid page-specific copies. Verify light/dark, 320px and 390px phones, desktop columns, long names, keyboard focus, and period-filter scope.
