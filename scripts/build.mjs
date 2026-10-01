import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const difficulties = ['easy', 'medium', 'hard'];
// The combined exam draws from four lessons. Each difficulty bank holds LESSON_SIZE questions from
// every lesson (BANK_SIZE in all); each question's `lesson` and `category` name its lesson.
export const LESSONS = ['ISR Operations', 'Armor Operations', 'Field Artillery Operations', 'Army Operations'];
export const LESSON_SIZE = 25;
export const BANK_SIZE = LESSONS.length * LESSON_SIZE;
// sourceSlides is optional. Slide numbers are meaningless across lessons, so the combined banks carry
// none (the reference is written into each explanation); when present it is still validated.
export const SOURCE_SLIDE_MIN = 1;
export const SOURCE_SLIDE_MAX = 200;

export function validateQuestion(question, expectedDifficulty, expectedId) {
  if (question === null || typeof question !== 'object' || Array.isArray(question)) {
    return ['question must be an object'];
  }

  const errors = [];
  if (!Number.isInteger(question.id) || question.id !== expectedId) {
    errors.push(`id must be integer ${expectedId}`);
  }
  if (question.difficulty !== expectedDifficulty) {
    errors.push(`difficulty must be ${expectedDifficulty}`);
  }
  for (const field of ['category', 'prompt', 'explanation']) {
    if (typeof question[field] !== 'string' || !question[field].trim()) {
      errors.push(`${field} must be a nonempty string`);
    }
  }
  if (!Array.isArray(question.tags) || question.tags.some(tag => typeof tag !== 'string' || !tag.trim())) {
    errors.push('tags must be an array of nonempty strings');
  }
  if (!Array.isArray(question.options) || question.options.length !== 4 || question.options.some(option => typeof option !== 'string' || !option.trim())) {
    errors.push('options must contain four nonempty strings');
  }
  if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer > 3) {
    errors.push('answer must be an integer from 0 to 3');
  }
  if (question.sourceSlides !== undefined && (!Array.isArray(question.sourceSlides) || question.sourceSlides.length === 0 || question.sourceSlides.some(slide => !Number.isInteger(slide) || slide < SOURCE_SLIDE_MIN || slide > SOURCE_SLIDE_MAX))) {
    errors.push(`sourceSlides, when present, must contain integers from ${SOURCE_SLIDE_MIN} to ${SOURCE_SLIDE_MAX}`);
  }
  return errors;
}

// Bank-level checks; the page's validateBanks reports the same errors prefixed with the difficulty.
export function validateBank(bank, difficulty) {
  const errors = [];
  if (bank.length !== BANK_SIZE) {
    errors.push(`bank must contain exactly ${BANK_SIZE} questions (found ${bank.length})`);
  }
  const counts = {};
  bank.forEach((question, index) => {
    for (const error of validateQuestion(question, difficulty, index + 1)) errors.push(`question ${index + 1}: ${error}`);
    if (question !== null && typeof question === 'object' && !Array.isArray(question)) {
      if (!LESSONS.includes(question.lesson) || question.category !== question.lesson) {
        errors.push(`question ${index + 1}: lesson must name one of the four lessons and equal category`);
      } else {
        counts[question.lesson] = (counts[question.lesson] || 0) + 1;
      }
    }
  });
  for (const lesson of LESSONS) {
    if ((counts[lesson] || 0) !== LESSON_SIZE) {
      errors.push(`bank must contain exactly ${LESSON_SIZE} ${lesson} questions (found ${counts[lesson] || 0})`);
    }
  }
  return errors;
}

export function buildHtml(template, banks) {
  let html = template;
  for (const difficulty of difficulties) {
    const placeholder = `{{${difficulty.toUpperCase()}_QUESTIONS}}`;
    if (html.split(placeholder).length !== 2) {
      throw new Error(`${placeholder} must occur exactly once`);
    }
    const json = JSON.stringify(banks[difficulty]).replaceAll('<', '\\u003c');
    html = html.replace(placeholder, () => json);
  }
  return html;
}

export function build() {
  const banks = {};
  for (const difficulty of difficulties) {
    const path = join(root, 'src', 'questions', `${difficulty}.json`);
    const bank = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(bank)) throw new Error(`${path} must contain an array`);
    const errors = validateBank(bank, difficulty);
    if (errors.length) throw new Error(`${path}: ${errors.join('; ')}`);
    banks[difficulty] = bank;
  }
  const template = readFileSync(join(root, 'src', 'template.html'), 'utf8');
  const html = buildHtml(template, banks);
  writeFileSync(join(root, 'index.html'), html);
  return html;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    build();
    console.log('Built index.html');
  } catch (error) {
    console.error(`Build failed: ${error.message}`);
    process.exitCode = 1;
  }
}
