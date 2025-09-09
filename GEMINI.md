# Codex Session Viewer

## Project Overview

This is a lightweight UI to inspect Codex CLI session logs. It is a React-based web application built with Vite and TypeScript.

**Main Technologies:**

* **Frontend:** React, TypeScript
* **Build Tool:** Vite
* **Testing:** Vitest
* **UI:** Headless UI, Monaco Editor, Tailwind CSS (implied by `@tailwindcss/vite`)
* **Schema Validation:** Zod

**Architecture:**

* The application is a single-page application (SPA) that runs entirely in the browser.
* It loads and parses `.jsonl` or `.ndjson` session log files.
* It provides a timeline view of events, a file tree, and a diff viewer.
* It uses IndexedDB for bookmark persistence.
* It can export data to JSON, Markdown, and HTML.

## Building and Running

* **Install Dependencies:**

    ```bash
    npm install
    ```

* **Run Development Server:**

    ```bash
    npm run dev
    ```

* **Build for Production:**

    ```bash
    npm run build
    ```

* **Run Tests:**

    ```bash
    npm run test
    ```

* **Run Tests in Watch Mode:**

    ```bash
    npm run test:watch
    ```

## Development Conventions

* **Coding Style:** The project uses TypeScript and likely follows standard React best practices. The presence of `zod` suggests a strong emphasis on data validation.
* **Testing:** The project uses Vitest for unit and integration testing. Test files are located in `__tests__` directories.
* **Contribution:** The `README.md` provides a good overview of the project's features and functionality. It should be consulted before making any changes.
