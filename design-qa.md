# Design QA — 灶边首页

- source visual truth path: `C:\Users\lenovo\.codex\generated_images\01a05078-92df-73c1-b9fe-97eb23922fa0\exec-f12986d0-252c-4e0b-bd8a-5fec5b495998.png`
- implementation screenshot path: `D:\Codex-chat\zaobian-recipe-pwa\qa\implementation-home-393x852.png`
- combined comparison path: `D:\Codex-chat\zaobian-recipe-pwa\qa\comparison-board-final.png`
- viewport: 1400 × 1200 browser viewport; iPhone app screen verified at 393 × 852 CSS px
- source pixels: 853 × 1920
- implementation pixels: 393 × 852 at devicePixelRatio 1
- density normalization: both artifacts rendered at 272 × 591 px in the comparison board; source used top-aligned `object-fit: cover` to normalize its slightly taller aspect ratio, implementation used a proportional 393 × 852 → 272 × 591 downscale
- state: fresh browser origin, default pantry `鸡腿肉 / 干辣椒 / 豆腐 / 鸡蛋`, default 2-person standard flavor profile, home route, iPhone device
- runtime integrity: `npm run check:runtime` passed for all 28 protected files before capture

## Full-view comparison evidence

The final combined board compares both artifacts in the same rendered input. The implementation preserves the source hierarchy and composition: dark cast-iron food backdrop; prominent one-line “家里有什么？” task; compact ingredient entry; light removable ingredient pills; chili-red primary CTA; result count; and a horizontal 辣子鸡 result card with image on the left and metadata on the right.

The app-owned bottom navigation and small “灶边 / 川·渝·湘·赣” identity line are intentional product additions required to make the four core workflows reachable. They do not displace or obscure the primary task.

## Focused region comparison evidence

The board repeats the source and implementation with the top task region emphasized. This made the display type weight, input treatment, chip wrapping, CTA height, top safe-area clearance, and vertical spacing readable enough to judge without another crop.

## Required fidelity surfaces

- Fonts and typography: final pass uses heavy sans-serif display text for the home task, compact bold labels for controls, stable one-line title wrapping, and readable Chinese fallbacks. The small product mark uses KaiTi intentionally as a brand accent.
- Spacing and layout rhythm: top content clears the device status bar; hero, input, chips, CTA, result header, and result card follow the source's dense vertical rhythm. Touch controls remain at least 40–56 px except compact chip dismiss affordances.
- Colors and visual tokens: cast-iron black, rice white, chili red, aged brass, and muted herb green map consistently to the selected mock. Text and primary controls retain high contrast.
- Image quality and asset fidelity: both visible culinary assets are generated raster images sized to their slots. No placeholder, emoji, inline SVG, CSS drawing, or stretched sprite is used. The final card crop keeps the food focal point sharp.
- Copy and content: app-specific copy is concise Chinese and directly explains pantry matching, near-match purchasing, regional cuisine, time, heat, and local-only persistence.

## Comparison history

### Pass 1 — blocked

- [P1] Home content started under the live status bar because an undefined top-inset token invalidated the padding declaration.
- [P2] The first implementation used a white search field, dark pantry chips, a second quick-add rail, and a full-bleed image card; these materially drifted from the selected mock's dark field, white chips, direct CTA-to-results rhythm, and horizontal result card.
- [P2] A cache-first development service worker could return stale application modules during review.

Fixes made:

- Added explicit device-safe top spacing without modifying the protected status-bar runtime.
- Switched the home heading to a bold sans display face, matched the dark/brass input and white pill treatment, moved quick-add into pantry management, and rebuilt the featured recipe as an image-left horizontal card.
- Limited service-worker registration to production and changed the production worker to prefer the network for navigation, JavaScript, and CSS while retaining offline cache fallback.

Post-fix evidence: `qa/comparison-board-final.png` shows the revised source and browser capture together at matched display dimensions.

### Pass 2 — passed

No actionable P0, P1, or P2 differences remain. The intentional brand line and four-tab navigation are acceptable product extensions. A P3-only refinement would be commissioning a dedicated square app icon instead of reusing the wok artwork in the install manifest.

## Primary interactions tested

- Add and remove pantry ingredients through the keyboard-aware field and chips.
- Pantry-to-recipe ranking and the primary “看看能做什么” path.
- Open recipe detail and add missing ingredients to the merged shopping list.
- Toggle a purchased item and verify browser-local persistence after reload.
- Change spice preference to “少量” and verify 辣子鸡 dry chili updates to 15 克 for two servings.
- Mark a cooking step complete and verify the safety guidance is present.
- Search the 36-recipe catalog and navigate with all four bottom tabs.

Console errors and warnings checked after the primary flow: none.

## Findings

No actionable P0/P1/P2 findings remain.

## Open questions

- None blocking. The current PWA is intentionally anonymous and local-only, so preferences and shopping data do not sync between browsers.

## Implementation checklist

- [x] Source and implementation captured and normalized.
- [x] Full-view and focused-region comparison completed in one input.
- [x] Pass-1 P1/P2 findings fixed and recaptured.
- [x] Runtime integrity, primary interactions, and console health verified.

## Follow-up polish

- [P3] Replace the wok crop with a dedicated 192/512 px maskable app icon if the product moves beyond MVP.

final result: passed
