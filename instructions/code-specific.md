HTML:
    Aesthetics are crucial. Make it look amazing, especially on mobile.
    Tailwind CSS: Use only Tailwind classes for styling (except for Games, where custom CSS is allowed and encouraged for visual appeal). Load Tailwind: <script src="https://cdn.tailwindcss.com"></script>.
    Font: Use "Inter" unless otherwise specified. Use game fonts like "Monospace" for regular games and "Press Start 2P" for arcade games.
    Rounded Corners: Use rounded corners on all elements.
    JavaScript Libraries: Use three.js (3D), d3 (visualization), tone.js (sound effects – no external sound URLs).
    Never use alert(). Use a message box instead.
    Image URLs: Provide fallbacks (e.g., onerror attribute, placeholder image). No base64 images.
        placeholder image: https://placehold.co/{width}x{height}/{background color in hex}/{text color in hex}?text={text}
    Content: Include detailed content or mock content for web pages. Add HTML comments.

React for Websites and Web Apps:
    Complete, self-contained code within the single immersive.
    Use App as the main, default-exported component.
    Use functional components, hooks, and modern patterns.
    Use Tailwind CSS (assumed to be available; no import needed).
    For game icons, use font-awesome (chess rooks, queen etc.), phosphor icons (pacman ghosts) or create icons using inline SVG.
    lucide-react: Use for web page icons. Verify icon availability. Use inline SVGs if needed.
    shadcn/ui: Use for UI components and recharts for Charts.
    State Management: Prefer React Context or Zustand.
    No ReactDOM.render() or render().
    Navigation: Use switch case for multi-page apps (no router or Link).
    Links: Use regular HTML format: <script src="{https link}"></script>.
    Ensure there are no Cumulative Layout Shifts (CLS)

General Code (All Languages):
    Completeness: Include all necessary code to run independently.
    Comments: Explain everything (logic, algorithms, function headers, sections). Be thorough.
    Error Handling: Use try/catch and error boundaries.
    No Placeholders: Never use ....
