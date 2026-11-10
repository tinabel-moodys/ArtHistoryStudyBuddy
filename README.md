# ArtHistoryStudyBuddy

Art history study and review app for macOS (Electron). Build exams from "must know" works and terms, then drill them with flashcards or multiple-choice quizzes. Scores are saved per exam.

## Requirements

- macOS
- [Node.js](https://nodejs.org) 18 or newer (includes `npm`)
- [Git](https://git-scm.com)
- Internet connection (artwork images and term definitions are fetched live)

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
   - Quizzes: pick from four choices.

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

## Project structure

```
main.js            Electron main process: creates the window
ipc.js             Main-process file access (read markdown, file picker)
preload.js         Exposes ipc to the page as window.api
renderer/
  index.html       Markup only
  styles.css       Styles only
  js/
    app.js         Entry point: event dispatch, view registration
    ui/            DOM rendering and event handlers (home, editor, study, router, dom helpers)
    quiz.js        Study logic: sources, cards, multiple-choice answers
    store.js       Exam persistence and score keeping (localStorage)
    markdown.js    Pure parsing of markdown and term text
    services/      Multi-step workflows: import, image lookup, random art
    api/           One client per data source: Met, Wikimedia Commons, Wikipedia, Wikidata
    data/          Static data
    util.js        Pure helpers
```

Dependencies point one way: `ui` → `quiz` / `store` / `services` → `api`. Only `ui` touches the DOM and only `store` touches `localStorage`.

## Data sources

[Met Museum Open Access API](https://metmuseum.github.io/), [Wikimedia Commons](https://commons.wikimedia.org), [Wikipedia](https://en.wikipedia.org), [Wikidata](https://www.wikidata.org).

## License

See [LICENSE](LICENSE).
