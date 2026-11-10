// Copies the non-TypeScript renderer assets next to the compiled JavaScript.
import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('build/renderer', { recursive: true });
for (const file of ['index.html', 'styles.css']) {
  copyFileSync(`src/renderer/${file}`, `build/renderer/${file}`);
}
