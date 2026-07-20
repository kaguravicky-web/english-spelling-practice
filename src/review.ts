import { SpellingItem, SpellingList } from "./types";

const REVIEW_WEEK_COUNT = 2;

const normalizeWordKey = (word: string) => word.toLowerCase().trim();

const isChineseList = (list: SpellingList) =>
  list.language === "zh" || list.items.some(item => /[\u4e00-\u9fa5]/.test(item.word));

const listLanguage = (list: SpellingList): "en" | "zh" => (isChineseList(list) ? "zh" : "en");

const parseListTimestamp = (id: string) => {
  const match = id.match(/^list-(\d+)$/);
  return match ? Number(match[1]) : 0;
};

const parseWeekNumber = (title: string) => {
  const match = title.match(/\bweek\s*(\d+)\b/i);
  return match ? Number(match[1]) : 0;
};

const recencyScore = (list: SpellingList, index: number) => {
  const timestamp = parseListTimestamp(list.id);
  if (timestamp > 0) return 1_000_000_000_000 + timestamp;

  const weekNumber = parseWeekNumber(list.week);
  if (weekNumber > 0) return weekNumber * 10_000 + index;

  return index;
};

const sourceItemsOnly = (items: SpellingItem[]) => items.filter(item => !item.reviewSource);

export function getRecentReviewLists(newList: SpellingList, existingLists: SpellingList[]) {
  const targetLanguage = listLanguage(newList);

  return existingLists
    .map((list, index) => ({ list, index }))
    .filter(({ list }) => list.id !== newList.id)
    .filter(({ list }) => list.id !== "wrong-words-notebook")
    .filter(({ list }) => listLanguage(list) === targetLanguage)
    .filter(({ list }) => sourceItemsOnly(list.items).length > 0)
    .sort((a, b) => recencyScore(b.list, b.index) - recencyScore(a.list, a.index))
    .slice(0, REVIEW_WEEK_COUNT)
    .map(({ list }) => list);
}

export function createPracticeListWithReview(newList: SpellingList, existingLists: SpellingList[]): SpellingList {
  const baseWords = new Set(newList.items.map(item => normalizeWordKey(item.word)));
  const reviewItems: SpellingItem[] = [];
  const reviewSources: string[] = [];

  for (const sourceList of getRecentReviewLists(newList, existingLists)) {
    const sourceItems = sourceItemsOnly(sourceList.items);
    const addedFromSource: SpellingItem[] = [];

    for (const item of sourceItems) {
      const wordKey = normalizeWordKey(item.word);
      if (!wordKey || baseWords.has(wordKey)) continue;

      baseWords.add(wordKey);
      addedFromSource.push({
        ...item,
        reviewSource: sourceList.week
      });
    }

    if (addedFromSource.length > 0) {
      reviewSources.push(sourceList.week);
      reviewItems.push(...addedFromSource);
    }
  }

  if (reviewItems.length === 0) return newList;

  return {
    ...newList,
    items: [...newList.items, ...reviewItems].map((item, index) => ({
      ...item,
      id: index + 1
    })),
    reviewSources
  };
}
