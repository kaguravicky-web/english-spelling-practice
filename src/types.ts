export interface SpellingItem {
  id: number;
  word: string;
  text: string; // example sentence
  definition?: string; // friendly explanation for child
  synonyms?: string[]; // similar meaning words
  antonyms?: string[]; // opposite meaning words
  clozeSentence?: string; // custom fill-in sentence, otherwise fallback to text replacement
  reviewSource?: string; // list title this review word came from
}

export interface SpellingList {
  id: string; // unique identifier
  week: string; // e.g. "Week 2 - Spelling 9"
  date?: string; // e.g. "7 July"
  items: SpellingItem[];
  isPreloaded?: boolean;
  language?: "en" | "zh"; // Added for language separation
  reviewSources?: string[]; // previous weekly lists mixed in for spaced review
}

export interface TestAttempt {
  id: string;
  listId: string;
  listTitle: string;
  date: string;
  score: number;
  total: number;
  mode: 'spelling' | 'vocabulary';
  results: {
    itemId: number;
    word: string;
    text: string;
    typed: string;
    isCorrect: boolean;
    hintUsed: boolean; // tracked to show if they checked dictionary or letter hints
  }[];
}

export interface ParentSettings {
  childName: string;
  speechRate: number; // e.g., 0.8 (slower for kids)
  speechVoice: string; // voice name
  fontSize?: "normal" | "large" | "huge"; // child font size scaling
}
