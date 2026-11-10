# ArtHistoryStudyBuddy

Art history study and review app for macOS (Electron).

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

## Usage

1. **+ Add Exam**, then name it.
2. Add content:
   - **Must Know Works:** search the Met and click Add, or import a markdown file.
   - **Must Know Terms:** one per line as `term: definition`, or import a markdown file.
   - **Random art pool (optional):** pull random Met art by department and year range.
3. **Save Exam**, then **Study**. Choose Flashcard or Quiz (multiple choice), and Works, Terms, or mixed.

Scores are saved per exam. Use ↺ on the home screen to reset them.

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

## Data sources

[Met Museum Open Access API](https://metmuseum.github.io/), [Wikimedia Commons](https://commons.wikimedia.org), [Wikipedia](https://en.wikipedia.org).

## License

See [LICENSE](LICENSE).
