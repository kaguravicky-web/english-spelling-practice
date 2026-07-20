import assert from "node:assert/strict";
import test from "node:test";

import { computeSentenceDiff, createSpellingHint, createVocabularyHint, normalizeWord } from "./utils.ts";

test("normalizeWord ignores case and surrounding punctuation", () => {
  assert.equal(normalizeWord("  Racing!  "), "racing");
});

test("computeSentenceDiff accepts an exact sentence", () => {
  const result = computeSentenceDiff("The car is fast.", "The car is fast.");

  assert.equal(result.hasSpellingError, false);
  assert.equal(result.hasCapitalizationError, false);
  assert.equal(result.hasPunctuationError, false);
  assert.deepEqual(result.segments.map(({ type }) => type), ["match", "match", "match", "match"]);
});

test("computeSentenceDiff separates error categories", () => {
  const spelling = computeSentenceDiff("The car is fast.", "The cat is fast.");
  const capitalization = computeSentenceDiff("The car is fast.", "the car is fast.");
  const punctuation = computeSentenceDiff("The car is fast.", "The car is fast");

  assert.equal(spelling.hasSpellingError, true);
  assert.equal(capitalization.hasCapitalizationError, true);
  assert.equal(punctuation.hasPunctuationError, true);
});

test("computeSentenceDiff identifies missing and extra words", () => {
  const missing = computeSentenceDiff("The red car wins.", "The car wins.");
  const extra = computeSentenceDiff("The car wins.", "The red car wins.");

  assert.ok(missing.segments.some(({ type, text }) => type === "missing" && text === "red"));
  assert.ok(extra.segments.some(({ type, text }) => type === "extra" && text === "red"));
});

test("createSpellingHint stays short and never reveals the answer", () => {
  const firstHint = createSpellingHint("because", "becuase", 1);
  const secondHint = createSpellingHint("because", "becuase", 2);

  assert.equal(firstHint, "Check letter 4. The word has 7 letters.");
  assert.equal(secondHint, "It starts with “b”. Check letter 4.");
  assert.equal(firstHint.toLowerCase().includes("because"), false);
  assert.equal(secondHint.toLowerCase().includes("because"), false);
});

test("createVocabularyHint varies by question type without giving the answer", () => {
  const fillIn = createVocabularyHint("fill-in", "because", undefined, 1);
  const synonym = createVocabularyHint("synonym", "large", "very big in size", 1);
  const antonym = createVocabularyHint("antonym", "tiny", "very big in size", 1);

  assert.equal(fillIn, "Use the sentence clue. The missing word has 7 letters.");
  assert.equal(synonym, "Look for a choice meaning nearly the same. The original word means: very big in size");
  assert.equal(antonym, "Look for a choice meaning the opposite. The original word means: very big in size");
  assert.equal(fillIn.includes("because"), false);
  assert.equal(synonym.includes("large"), false);
  assert.equal(antonym.includes("tiny"), false);
});
