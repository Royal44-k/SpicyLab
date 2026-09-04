# Keyboard, Matching, and Stability Design

**Date:** 2026-09-04

**Status:** Approved by the user on 2026-09-04

## Goal

Make the “灶边” ingredient-to-recipe journey reliable under normal and repeated use: text entry behaves like a mobile form, pantry changes drive real recipe ranking, navigation does not retain stale screens or focus, and the same ingredient rules are used by recommendations, recipe details, and shopping lists.

## Confirmed Product Behavior

- A new user starts with an empty pantry. Example ingredients remain suggestions and are never silently treated as owned ingredients.
- Enter and the plus button commit the current draft, clear the field, and dismiss the simulated keyboard.
- “看看能做什么” commits any non-empty draft before calculating results, dismisses the keyboard, and scrolls the current home screen to its result section.
- Tapping outside a text field or starting a scroll dismisses the keyboard but preserves an uncommitted draft.
- A dismissed field can always be focused again.
- Zero-match recipes are not presented as “closest” matches. They may remain visible in the browse catalog, but the ingredient-driven home result contains only recipes with a positive ingredient match.
- Invalidly broad fragments such as “肉” or “毛血” do not match arbitrary ingredient names.
- Repeated add, tab, detail, and back actions are idempotent and do not create duplicate current screens.
- Existing saved user data is preserved. Only the fallback for users without saved state changes from four seeded pantry items to an empty pantry.

## Interaction Model

The text field owns a local draft. Committing is explicit and deterministic. Blur changes focus and keyboard visibility only; it does not mutate pantry data. Enter, plus, and the primary CTA use one shared commit function so their business behavior cannot drift.

The simulated keyboard is runtime chrome, but its lifecycle follows DOM focus. The keyboard provider keeps a stable reference to the active text field and stable `show`/`hide` functions. A capture-phase outside-pointer listener dismisses the current keyboard session before app buttons execute, except when the pointer remains inside a text-entry control or the keyboard dock. Field blur closes the keyboard after allowing a direct focus transfer to another text field.

Focused input groups receive a visible focus treatment. Dismissal must never erase the draft, move the user to another route, or leave the input hidden behind fixed UI.

## Ingredient Matching Model

Ingredient text is normalized through one canonical alias table. Exact aliases such as “鸡腿” → “鸡腿肉”, “带皮五花肉” → “五花肉”, and “干红辣椒” → “干辣椒” are stored canonically. A small directional compatibility table supports deliberate generic inputs such as “鸡肉” without allowing unrestricted substring matching.

Each required main ingredient has weight 3 and each required side ingredient has weight 1. Exact matches receive full weight; approved compatible matches receive reduced weight. Recipes sort by:

1. all required ingredients available;
2. weighted match ratio descending;
3. missing required ingredient count ascending;
4. cooking time ascending;
5. source catalog order for deterministic ties.

Seasonings and aromatics remain visible in detail and shopping views but do not determine whether cooking can start. The exported matcher is the sole source for ranking, detail ownership markers, and shopping-list omission.

## State and Navigation Architecture

Local application mutations move into a pure reducer so rapid events are applied atomically and can be unit-tested. Actions are stable callbacks; persisted state remains in `localStorage` under the existing key.

`FlowStack` keeps stable navigation callbacks independent of keyboard animation state. `push` and `replace` reject a screen whose id is already current. App code never uses an unscoped document query to find a result section; the home screen scrolls its own ref. Bottom navigation subscribes to the newest current screen during transitions.

The service-worker cache version is incremented so the published build cannot retain an older app shell after this behavioral release.

## Error and Empty States

- Empty pantry: explain that the user should add one or more ingredients and keep common suggestions available.
- Pantry with no positive matches: explain that no precise match was found and suggest a more specific ingredient name.
- Duplicate aliases: treat the operation as successful and idempotent; never add duplicate chips.
- Corrupt persisted state: normalize safely to an empty pantry and default preferences.

## Verification

Unit tests cover canonicalization, dangerous partial inputs, weighted sorting, state reducer idempotency, and cross-feature matcher consistency. Browser tests cover Enter, plus, CTA commit, outside dismissal, refocus, draft preservation, zero-match empty state, rapid repeated actions, tab switching, detail/back restoration, footer clearance, and both iPhone and Pixel runtime geometry.

Final verification includes runtime integrity, TypeScript production build, Sites worker tests, in-app browser interaction checks, and post-deployment checks on the existing public URL.

