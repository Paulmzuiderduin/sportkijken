# AI Context & Recent Changes - Sportkijken

*This document is meant to provide context to AI assistants (like Codex) about the current state and recent architectural changes in the `sportkijken` project.*

## Recent Major Updates (May 2026)

The application has recently undergone significant changes to improve **mobile responsiveness** and **scroll performance**. If you are modifying `App.jsx` or `styles.css`, please keep the following constraints and features in mind:

### 1. Responsive Filters (collapsed by default)
- **The Problem:** The filter panel took up too much vertical space, pushing the actual events below the fold on both mobile and desktop.
- **The Solution:** The filter panel is now collapsible on every screen size.
- **Implementation in `App.jsx`:** We use the `filtersExpandedOnMobile` state. A button (`.mobile-filter-toggle`) is rendered before the filters panel. When clicked, it toggles the `is-expanded-mobile` class on the `.filters-panel`.
- **Implementation in `styles.css`:**
  - `.filters-panel` has `display: none` by default and switches to `display: grid` when `is-expanded-mobile` is present.
  - `.mobile-filter-toggle` is visible on all screen sizes.
  - Keep the event list above the filters in the visual hierarchy; the main CTA links to `#agenda`.

### 2. Scroll Performance (Lazy Loading / Pagination)
- **The Problem:** Grouping and rendering 30+ days of events at once resulted in thousands of React DOM nodes, causing the app to freeze/lag on mobile during scrolling and state updates.
- **The Solution:** A basic form of pagination/lazy loading was introduced.
- **Implementation in `App.jsx`:** 
  - A `useState` hook called `visibleDaysCount` (defaults to 1) controls how many days are initially rendered.
  - The `groupedEvents` array is sliced: `groupedEvents.slice(0, visibleDaysCount).map(...)`.
  - A "Laad meer dagen" (Load more days) button at the bottom of the list increments `visibleDaysCount` by 2.
- **Rule:** Do NOT remove `visibleDaysCount` or revert to rendering all `groupedEvents` at once, as this will break mobile performance.
- **Rule:** Do NOT add heavy CSS animations (like `fade-slide`) to `.event-card` or other elements that are rendered in bulk. Animating 50+ elements simultaneously causes massive main thread freezing on mobile devices.

### 3. Ambient Background Performance
- **The Problem:** The decorative background blur circles (`.ambient`) were causing massive scroll lag on mobile because they used `position: fixed` and `filter: blur()`.
- **The Solution:** Changed to `position: absolute` and added `transform: translateZ(0)` in `styles.css` to offload painting to the GPU and prevent continuous repaints during scrolling. Do not revert these back to `position: fixed`.

## General Guidelines
- Do not use Tailwind classes in this project; all styling relies on Vanilla CSS in `styles.css`.
- The dataset fetching logic (`loadCachedDataset`) and SEO routing should remain intact.
- ESPN's scoreboard API no longer accepts date ranges (`YYYYMMDD-YYYYMMDD`). `scripts/update-events.mjs` queries whole months (`YYYYMM`) instead; keep that behaviour and the per-month 1000-event limit.
- Past events are pruned before the (now optional) `MAX_EVENTS` cap. Do not reintroduce a cap that can cut off the end of the 180-day schedule.
