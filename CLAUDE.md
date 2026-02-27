# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev      # Start Vite dev server
npm run build    # Production build
npm run preview  # Preview production build
```

No test framework is configured. There is no lint setup.

## Architecture

This is a **single-page vanilla JS app** with no framework dependencies. The entire application is contained in three files:

- `index.html` — all HTML structure including static overlays/modals
- `main.js` — all application logic (single IIFE, ~510 lines)
- `style.css` — all styles with CSS custom properties for theming

### State Management

All state lives in a single `appState` object in `main.js`:
- `tasks[]` — array of `{ id, title, date, completed, focusedTime, tomatoes }`
- `focus` — active Pomodoro session state (`active`, `paused`, `taskId`, `totalElapsed`, `cycleElapsed`, `sessionTomatoes`, `interval`)
- `sessionStats` — today's focus session count, resets daily
- `selectedDate` — currently viewed date (YYYY-MM-DD string)
- `currentFilter` — `'all'` or `'completed'`

Persistence is via `localStorage` under key `focus_tasks_v14`. The `save()` / `load()` functions handle serialization.

### Rendering Pattern

The app uses a **full re-render** approach. `render()` calls three sub-renderers:
- `renderCalendar()` — rebuilds the 15-day calendar strip (-7 to +7 from selected date)
- `renderTasks()` — rebuilds the task list filtered by `selectedDate` and `currentFilter`
- `renderStats()` — updates sidebar statistics (today/week/month focus time, tomato count)

DOM manipulation uses `document.getElementById` (aliased as `el()`) exclusively; no virtual DOM.

### Pomodoro Timer

- One cycle = `POMODORO_CYCLE` seconds (1500 = 25 min)
- `setInterval` ticks every second; updates `cycleElapsed` and `totalElapsed`
- Each completed cycle increments `task.tomatoes` and saves
- Minimum 30 seconds (`MIN_SESSION_SECONDS`) for a session to count toward `sessionStats.count`
- SVG circle progress uses `stroke-dashoffset` on a circumference of `TIMER_CIRCUMFERENCE = 289`

### UI Conventions

- CSS custom properties defined in `:root` handle light/dark theme (`prefers-color-scheme`)
- All modals share the `.overlay` / `.overlay.hidden` toggle pattern via `classList`
- Mobile breakpoint at `900px`: sidebar slides in from left using `position: fixed` + `.open` class
- Tablet breakpoint at `1024px`: reduced padding only
- The "Chiikawa" study buddy character is pure CSS — animated via `@keyframes chiBob` / `chiWrite`
- Toast notifications are appended to `#toast-container` and auto-remove after 4 seconds
