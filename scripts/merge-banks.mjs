// Regenerates src/questions/{easy,medium,hard}.json from the four lesson quiz repositories,
// which must sit next to this repository (../isr-mastery-quiz, ../armor-mastery-quiz,
// ../field-artillery-mastery-quiz, ../publish-site). The lesson repositories are only read.
//
//   node scripts/merge-banks.mjs && node scripts/build.mjs && node scripts/verify.mjs
//
// Each combined bank holds the 25 questions of that difficulty from every lesson (100 in all),
// re-numbered 1..100 in lesson order. `category` and `lesson` become the lesson name so the
// results topic analysis reports strengths and gaps by lesson. Slide or page numbers only make
// sense inside their own lesson, so sourceSlides is removed and the reference is appended to
// the explanation instead, e.g. "(Armor Operations, page 31)". Option order is unchanged.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const work = dirname(root);
export const LESSON_SOURCES = [
  { lesson: 'ISR Operations', repo: 'isr-mastery-quiz', unit: ['slide', 'slides'] },
  { lesson: 'Armor Operations', repo: 'armor-mastery-quiz', unit: ['page', 'pages'] },
  { lesson: 'Field Artillery Operations', repo: 'field-artillery-mastery-quiz', unit: ['slide', 'slides'] },
  { lesson: 'Army Operations', repo: 'publish-site', unit: null },
];

function reference(source, slides) {
  if (!source.unit || !Array.isArray(slides) || !slides.length) return '';
  const unit = slides.length === 1 ? source.unit[0] : source.unit[1];
  return ` (${source.lesson}, ${unit} ${slides.join(', ')})`;
}

for (const difficulty of ['easy', 'medium', 'hard']) {
  const merged = [];
  for (const source of LESSON_SOURCES) {
    const bank = JSON.parse(readFileSync(join(work, source.repo, 'src', 'questions', `${difficulty}.json`), 'utf8'));
    if (bank.length !== 25) throw new Error(`${source.repo} ${difficulty} must have 25 questions (found ${bank.length})`);
    for (const item of bank) {
      merged.push({
        id: merged.length + 1,
        difficulty,
        category: source.lesson,
        lesson: source.lesson,
        tags: item.tags,
        prompt: item.prompt,
        options: item.options,
        answer: item.answer,
        explanation: item.explanation.trim() + reference(source, item.sourceSlides),
      });
    }
  }
  writeFileSync(join(root, 'src', 'questions', `${difficulty}.json`), `${JSON.stringify(merged, null, 2)}\n`);
  console.log(`Wrote ${difficulty}.json (${merged.length} questions)`);
}
