# ArtHistoryStudyBuddy

Art history study and review app for macOS (Electron + TypeScript). Build exams from "must know" works and terms, then drill them with flashcards or multiple-choice quizzes. Scores are saved per exam.

## Requirements

- macOS
- [Node.js](https://nodejs.org) 22.13 or newer (includes `npm`)
- [Git](https://git-scm.com)
- Internet connection (artwork images, definitions and nationalities are fetched live)

## Installation

```bash
git clone https://github.com/tinabel/ArtHistoryStudyBuddy.git
cd ArtHistoryStudyBuddy
npm install
```

## Run

```bash
npm start
```

This compiles the TypeScript to `build/` and launches the app.

## Package as a macOS app

```bash
npm run package
```

This builds `dist/Art History Study-darwin-<arch>/Art History Study.app` for your Mac's architecture. Drag it into `/Applications`.

The app is unsigned. On another Mac, right-click → **Open** the first time to get past Gatekeeper.

The packaged app keeps its own saved data, separate from `npm start`, so exams made in one won't appear in the other.

## Usage

1. **+ Add Exam**, then name it.
2. Add content:
   - **Must Know Works:** search the Met and click Add, or import a markdown file.
   - **Must Know Terms:** one per line as `term: definition`, or import a markdown file.
   - **Random art pool (optional):** pull random Met art by department and year range.
3. **Save Exam**, then **Study**. Choose Flashcard or Quiz, and Works, Terms, or mixed.
   - Flashcards: reveal the answer, then mark **Got it** or **Missed**.
   - Quizzes: pick from four choices. In term quizzes the term is blanked out of its own definition.

Use ↺ on the home screen to reset an exam's scores.

### Markdown import

Type a file path (or use **Browse…**) in the exam editor. See [`sample-exam.md`](sample-exam.md).

```md
# Exam Name

## Must Know Works
- Artist, Title, Date (p. 123)

## Must Know Terms
- Term
- Term: definition
```

- Works get images from Wikimedia Commons, then the Met. Some may have no image.
- Terms without a definition are auto-filled from Wikipedia. Review them, since they can be generic or wrong.
- Every work and term links to its source.
- Each artist's nationality (e.g. "French") comes from the Met record or Wikidata and shows with the answer. Exams saved before this existed fill it in the first time a work comes up. Check it for historical cases: Wikidata may say "Prussian" where your course says "German".

## Development

| Command | What it does |
|---|---|
| `npm start` | Build, then launch the app |
| `npm run build` | Compile TypeScript to `build/` and copy HTML/CSS |
| `npm run typecheck` | Type-check source and tests (no output files) |
| `npm run lint` | ESLint with `typescript-eslint` (strict, type-checked) |
| `npm test` | Run the Jest tests |
| `npm run test:coverage` | Tests with a coverage report |
| `npm run package` | Build and package the `.app` |

Tests never touch the network: `fetch` is stubbed. UI tests run the real UI modules in jsdom.

Pull requests run typecheck, lint, tests and build in GitHub Actions (`.github/workflows/ci.yml`).

### Project structure

```
src/
  main/            Electron main process (CommonJS)
    main.ts          creates the window
    ipc.ts           file access the sandboxed page can't do itself
    paths.ts         path normalisation (pure)
    preload.ts       exposes a typed window.api to the page
  shared/api.d.ts  the window.api contract, shared by main and renderer
  renderer/        the page (ES modules, runs in the browser)
    index.html       markup only
    styles.css       styles only
    js/
      app.ts           entry point: event dispatch, view registration
      ui/              DOM rendering and event handlers (home, editor, study, router, dom helpers)
      quiz.ts          study logic: sources, cards, multiple-choice answers
      store.ts         exam persistence and score keeping (localStorage)
      markdown.ts      pure parsing of markdown and term text
      textMask.ts      pure: hides a term inside its definition
      services/        multi-step workflows: import, image lookup, nationality, random art
      api/             one client per data source: Met, Wikimedia Commons, Wikipedia, Wikidata
      data/            static data
      types.ts, util.ts
test/              Jest tests (unit, plus jsdom UI tests)
build/             compiled output (git-ignored)
```

Dependencies point one way: `ui` → `quiz` / `store` / `services` → `api`. Only `ui` touches the DOM and only `store` touches `localStorage`.

## Data sources

[Met Museum Open Access API](https://metmuseum.github.io/), [Wikimedia Commons](https://commons.wikimedia.org), [Wikipedia](https://en.wikipedia.org), [Wikidata](https://www.wikidata.org).

## License

See [LICENSE](LICENSE).
