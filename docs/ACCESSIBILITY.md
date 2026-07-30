# Accessibility

- WCAG 2.2 AA intent for all retained critical flows.
- Skip link and semantic main/navigation landmarks.
- Visible focus rings and keyboard-operable buttons, tables/cards, tabs, dialogs, and drawers.
- Radix Dialog supplies focus trapping, Escape close, and focus restoration.
- Icon buttons always have accessible labels.
- Status combines icon, text, and semantic color.
- Execution progress uses a polite live region; errors use alerts.
- Tables have captions/headers and become actionable cards on mobile.
- React Flow has a complete keyboard-readable vertical step fallback.
- Reduced motion disables smooth scroll, transitions, WebGL animation, and node pulses.
- Three.js failure, reduced-motion, and mobile contexts use the static SVG state field.
- Unknown and partial outcomes use explicit safety language and never rely on color.

The MVP removed the global command palette and notification drawer, reducing focus
surfaces that were not needed for the core journey.
