import assert from "node:assert/strict";
import test from "node:test";

import { computeSentenceDiff, createSpellingHint, createVocabularyHint, normalizeWord } from "./utils.ts";
import { createPracticeListWithReview, getRecentReviewLists } from "./review.ts";
import { SpellingList } from "./types.ts";

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

test("createPracticeListWithReview adds deduped words from the two most recent same-language lists", () => {
  const week7: SpellingList = {
    id: "week7",
    week: "Week 7",
    language: "en",
    items: [{ id: 1, word: "older", text: "An older word." }]
  };
  const week8: SpellingList = {
    id: "week8",
    week: "Week 8",
    language: "en",
    items: [{ id: 1, word: "recent", text: "A recent word." }]
  };
  const week9: SpellingList = {
    id: "week9",
    week: "Week 9",
    language: "en",
    items: [
      { id: 1, word: "latest", text: "A latest word." },
      { id: 2, word: "because", text: "Duplicate current word." }
    ]
  };
  const chinese: SpellingList = {
    id: "week9-zh",
    week: "Week 9",
    language: "zh",
    items: [{ id: 1, word: "复习", text: "复习很重要。" }]
  };
  const current: SpellingList = {
    id: "list-200",
    week: "Week 10",
    language: "en",
    items: [{ id: 1, word: "because", text: "Because I tried." }]
  };

  const recent = getRecentReviewLists(current, [week7, week8, week9, chinese]);
  const withReview = createPracticeListWithReview(current, [week7, week8, week9, chinese]);

  assert.deepEqual(recent.map(list => list.week), ["Week 9", "Week 8"]);
  assert.deepEqual(withReview.items.map(item => item.word), ["because", "latest", "recent"]);
  assert.deepEqual(withReview.reviewSources, ["Week 9", "Week 8"]);
  assert.equal(withReview.items[1].reviewSource, "Week 9");
});
