/**
 * Helper to normalize string for comparison
 */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’“”]/g, "")
    .trim();
}

export interface DiffSegment {
  type: "match" | "mismatch" | "missing" | "extra" | "punctuation_error" | "capitalization_error";
  text: string; // The typed word (or original word if missing)
  expected?: string; // What was expected
}

/**
 * Perform a word-by-word diff of the typed sentence against the expected sentence.
 * This is perfect for Singapore primary spelling/dictation tests.
 */
export function computeSentenceDiff(expected: string, typed: string): {
  segments: DiffSegment[];
  hasSpellingError: boolean;
  hasCapitalizationError: boolean;
  hasPunctuationError: boolean;
} {
  // Normalize double quotes, curly single quotes
  const cleanExpected = expected.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  const cleanTyped = typed.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

  // Regex to split by whitespace but preserve punctuation attached to words
  const expectedWords = cleanExpected.split(/\s+/).filter(Boolean);
  const typedWords = cleanTyped.split(/\s+/).filter(Boolean);

  const segments: DiffSegment[] = [];
  let eIdx = 0;
  let tIdx = 0;

  let hasSpellingError = false;
  let hasCapitalizationError = false;
  let hasPunctuationError = false;

  // Simple heuristic-based sequence matching for word comparison
  while (eIdx < expectedWords.length || tIdx < typedWords.length) {
    const eWord = expectedWords[eIdx];
    const tWord = typedWords[tIdx];

    // Case 1: Reached end of expected, but still have typed words (Extra words)
    if (!eWord) {
      segments.push({ type: "extra", text: tWord });
      tIdx++;
      continue;
    }

    // Case 2: Reached end of typed, but still have expected words (Missing words)
    if (!tWord) {
      segments.push({ type: "missing", text: eWord, expected: eWord });
      hasSpellingError = true;
      eIdx++;
      continue;
    }

    // Extract raw words without punctuation or casing
    const eNorm = normalizeWord(eWord);
    const tNorm = normalizeWord(tWord);

    // Exact match including case and punctuation
    if (eWord === tWord) {
      segments.push({ type: "match", text: tWord });
      eIdx++;
      tIdx++;
      continue;
    }

    // Normalized word match (Spelling matches, but maybe case or punctuation is wrong)
    if (eNorm === tNorm) {
      // Check for capitalization mistake
      if (eWord.toLowerCase() !== tWord.toLowerCase() && eNorm === tNorm) {
        // Just casing is wrong (e.g. "mother" vs "Mother")
        segments.push({
          type: "capitalization_error",
          text: tWord,
          expected: eWord
        });
        hasCapitalizationError = true;
      } else {
        // Punctuation is different (e.g. "photograph." vs "photograph")
        segments.push({
          type: "punctuation_error",
          text: tWord,
          expected: eWord
        });
        hasPunctuationError = true;
      }
      eIdx++;
      tIdx++;
      continue;
    }

    // Lookahead to see if we missed a word or added a word
    const nextTWord = typedWords[tIdx + 1];
    const nextEWord = expectedWords[eIdx + 1];

    if (nextTWord && normalizeWord(nextTWord) === eNorm) {
      // The current typed word is extra
      segments.push({ type: "extra", text: tWord });
      tIdx++;
    } else if (nextEWord && normalizeWord(nextEWord) === tNorm) {
      // The current expected word was missed by the user
      segments.push({ type: "missing", text: eWord, expected: eWord });
      hasSpellingError = true;
      eIdx++;
    } else {
      // Direct replacement/mismatch (Spelling mistake or entirely different word)
      segments.push({
        type: "mismatch",
        text: tWord,
        expected: eWord
      });
      hasSpellingError = true;
      eIdx++;
      tIdx++;
    }
  }

  return {
    segments,
    hasSpellingError,
    hasCapitalizationError,
    hasPunctuationError
  };
}

/**
 * Text-to-Speech Helper inside the browser.
 * Reads words or sentences out loud with adjustable speed.
 */
export function speakText(
  text: string, 
  rate: number = 0.8, 
  voiceName?: string,
  onStart?: () => void,
  onEnd?: () => void
) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    console.warn("Speech synthesis is not supported in this browser.");
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  // Create utterance
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate; // slower speed is highly effective for spelling
  utterance.pitch = 1.0;

  // Find and set voice if provided
  if (voiceName) {
    const voices = window.speechSynthesis.getVoices();
    const selectedVoice = voices.find(v => v.name === voiceName);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
  }

  if (onStart) utterance.onstart = onStart;
  if (onEnd) utterance.onend = onEnd;

  window.speechSynthesis.speak(utterance);
}

/**
 * Get available speechSynthesis voices
 */
export function getSpeechVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return [];
  }
  return window.speechSynthesis.getVoices();
}
