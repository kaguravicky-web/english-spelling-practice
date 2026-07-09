import React, { useState, useEffect, useRef } from "react";
import { SpellingList, SpellingItem, TestAttempt, ParentSettings } from "../types";
import {
  Volume2,
  VolumeX,
  Sparkles,
  ArrowRight,
  HelpCircle,
  Play,
  RotateCcw,
  Check,
  Award,
  BookOpen,
  Trophy,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Clock,
  Book,
  Star,
  GraduationCap
} from "lucide-react";
import { speakText } from "../utils";
import { encouragementPhrases, tryAgainPhrases } from "../data";

interface ChildDashboardProps {
  spellingLists: SpellingList[];
  onCompleteTest: (attempt: TestAttempt) => void;
  settings: ParentSettings;
  avatarEmoji: string;
  onUpdateSettings?: (updater: (prev: ParentSettings) => ParentSettings) => void;
}

export default function ChildDashboard({
  spellingLists,
  onCompleteTest,
  settings,
  avatarEmoji,
  onUpdateSettings
}: ChildDashboardProps) {
  // Navigation states
  const [selectedList, setSelectedList] = useState<SpellingList | null>(null);
  const [practiceMode, setPracticeMode] = useState<"spelling" | "vocabulary" | "flashcard" | null>(null);
  
  // Difficulty Selection
  const [spellingDifficulty, setSpellingDifficulty] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [isChoosingDifficulty, setIsChoosingDifficulty] = useState(false);

  // Dictionary / Meaning Overlay state
  const [showDictionary, setShowDictionary] = useState(false);

  // Core Practice loop states
  const [currentIndex, setCurrentIndex] = useState(0);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [hasChecked, setHasChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Hint rules tracking: did the kid look up word definitions or show letter hints for the current word?
  const [currentHintUsed, setCurrentHintUsed] = useState(false);

  // Test session state
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Vocabulary Quiz State
  const [vocabQuestion, setVocabQuestion] = useState<{
    questionText: string;
    type: "synonym" | "antonym" | "fill-in";
    options: string[];
    correctAnswer: string;
  } | null>(null);

  // Encouragement phrases
  const [currentEncouragement, setCurrentEncouragement] = useState("");

  const speechRate = settings?.speechRate ?? 0.7;

  // Speak when an item loads
  useEffect(() => {
    if (selectedList && practiceMode && !isCompleted && practiceMode !== "flashcard") {
      const currentItem = selectedList.items[currentIndex];
      
      // Reset input state for the new question
      setTypedAnswer("");
      setHasChecked(false);
      setIsCorrect(false);
      setAttempts(0);
      setShowHint(false);
      setCurrentHintUsed(false);

      if (currentItem) {
        if (practiceMode === "spelling") {
          playQuestionAudio(currentItem);
        } else if (practiceMode === "vocabulary") {
          // Generate a brand new vocabulary question dynamically
          const question = generateVocabQuestion(currentItem, selectedList);
          setVocabQuestion(question);
          // Auto speak question text
          speakText(
            question.type === "fill-in" ? "Choose the correct word to fill in the blank!" : question.questionText, 
            speechRate, 
            settings.speechVoice
          );
        }
      }
    }
  }, [currentIndex, selectedList, practiceMode, isCompleted]);

  // Set randomized encouraging phrase
  const triggerEncouragement = (success: boolean) => {
    const list = success ? encouragementPhrases : tryAgainPhrases;
    const phrase = list[Math.floor(Math.random() * list.length)];
    setCurrentEncouragement(phrase);
  };

  // Speaks spelling item: word -> sentence -> word
  const playQuestionAudio = (item: SpellingItem) => {
    if (!item) return;
    setIsSpeaking(true);

    if (practiceMode === "spelling") {
      speakText(`${item.word}`, speechRate, settings.speechVoice, () => {}, () => {
        speakText(`"${item.text}"`, speechRate, settings.speechVoice, () => {}, () => {
          speakText(`${item.word}`, speechRate, settings.speechVoice, () => {}, () => {
            setIsSpeaking(false);
          });
        });
      });
    } else if (practiceMode === "vocabulary" && vocabQuestion) {
      speakText(vocabQuestion.questionText, speechRate, settings.speechVoice, () => {}, () => {
        setIsSpeaking(false);
      });
    }
  };

  const handleSpeakWordOnly = () => {
    if (!selectedList) return;
    const item = selectedList.items[currentIndex];
    setIsSpeaking(true);
    speakText(item.word, speechRate, settings.speechVoice, () => {}, () => {
      setIsSpeaking(false);
    });
  };

  const handleSpeakSentenceOnly = () => {
    if (!selectedList) return;
    const item = selectedList.items[currentIndex];
    setIsSpeaking(true);
    speakText(item.text, speechRate, settings.speechVoice, () => {}, () => {
      setIsSpeaking(false);
    });
  };

  // Selection handlers
  const handleSelectList = (list: SpellingList) => {
    const sortedItems = [...list.items].sort((a, b) => a.word.length - b.word.length);
    setSelectedList({
      ...list,
      items: sortedItems
    });
    setPracticeMode(null);
  };

  const handleStartPractice = (mode: "spelling" | "vocabulary" | "flashcard") => {
    if (mode === "spelling") {
      // Trigger difficulty selection first
      setIsChoosingDifficulty(true);
    } else {
      startSession(mode);
    }
  };

  const startSession = (mode: "spelling" | "vocabulary" | "flashcard") => {
    setPracticeMode(mode);
    setIsChoosingDifficulty(false);
    setCurrentIndex(0);
    setTypedAnswer("");
    setHasChecked(false);
    setTestResults([]);
    setIsCompleted(false);
  };

  // Generate vocabulary questions
  const generateVocabQuestion = (item: SpellingItem, list: SpellingList) => {
    const hasSynonyms = item.synonyms && item.synonyms.length > 0;
    const hasAntonyms = item.antonyms && item.antonyms.length > 0;
    
    const types: ("fill-in" | "synonym" | "antonym")[] = ["fill-in"];
    if (hasSynonyms) types.push("synonym");
    if (hasAntonyms) types.push("antonym");
    
    // Select stable question type using index/id
    const chosenType = types[(item.id + currentIndex) % types.length];
    
    if (chosenType === "synonym" && item.synonyms && item.synonyms.length > 0) {
      const correctAns = item.synonyms[0];
      const otherSyns = list.items
        .filter(i => i.id !== item.id && i.synonyms && i.synonyms.length > 0)
        .map(i => i.synonyms![0]);
      const distractors = otherSyns.slice(0, 3);
      while (distractors.length < 3) {
        distractors.push("ordinary life", "different category", "something else");
      }
      const options = [correctAns, ...distractors].sort(() => Math.sin(item.id) - 0.5);
      return {
        questionText: `Which word or phrase means nearly the SAME as "${item.word}"?`,
        type: "synonym" as const,
        options,
        correctAnswer: correctAns
      };
    } else if (chosenType === "antonym" && item.antonyms && item.antonyms.length > 0) {
      const correctAns = item.antonyms[0];
      const otherAnts = list.items
        .filter(i => i.id !== item.id && i.antonyms && i.antonyms.length > 0)
        .map(i => i.antonyms![0]);
      const distractors = otherAnts.slice(0, 3);
      while (distractors.length < 3) {
        distractors.push("normal thing", "common idea", "same pattern");
      }
      const options = [correctAns, ...distractors].sort(() => Math.sin(item.id) - 0.5);
      return {
        questionText: `Which word or phrase means the OPPOSITE of "${item.word}"?`,
        type: "antonym" as const,
        options,
        correctAnswer: correctAns
      };
    } else {
      // Cloze/Fill-in
      const wordRegex = new RegExp(`\\b${item.word}\\b`, "gi");
      let clozeText = item.text.replace(wordRegex, "_______");
      if (!clozeText.includes("_______")) {
        clozeText = item.text.replace(item.word, "_______");
      }
      
      const correctAns = item.word;
      const otherWords = list.items
        .filter(i => i.id !== item.id)
        .map(i => i.word);
      const distractors = otherWords.slice(0, 3);
      const options = [correctAns, ...distractors].sort(() => Math.sin(item.id) - 0.5);
      return {
        questionText: `Choose the correct word to fill in the blank:\n\n"${clozeText}"`,
        type: "fill-in" as const,
        options,
        correctAnswer: correctAns
      };
    }
  };

  // Submit Answer Validation
  const checkAnswer = (selectedOption?: string) => {
    if (!selectedList) return;
    const currentItem = selectedList.items[currentIndex];
    
    let correct = false;
    if (practiceMode === "spelling") {
      const userTyped = typedAnswer.trim();
      correct = userTyped.toLowerCase() === currentItem.word.toLowerCase();
    } else if (practiceMode === "vocabulary" && vocabQuestion) {
      const chosen = selectedOption || typedAnswer.trim();
      correct = chosen === vocabQuestion.correctAnswer;
      if (selectedOption) {
        setTypedAnswer(selectedOption);
      }
    }

    setIsCorrect(correct);
    setHasChecked(true);
    setAttempts(prev => prev + 1);
    triggerEncouragement(correct);

    if (correct) {
      speakText("Awesome! That is correct!", 0.9, settings.speechVoice);
    } else {
      speakText("Let's try that one again.", 0.9, settings.speechVoice);
    }
  };

  // Next Question or Finish Test Session
  const handleNext = () => {
    if (!selectedList) return;
    const currentItem = selectedList.items[currentIndex];

    // Record results
    const newResult = {
      itemId: currentItem.id,
      word: currentItem.word,
      text: currentItem.text,
      typed: typedAnswer,
      isCorrect: isCorrect,
      hintUsed: currentHintUsed
    };

    const updatedResults = [...testResults, newResult];
    setTestResults(updatedResults);

    if (currentIndex < selectedList.items.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Test is fully completed!
      setIsCompleted(true);
      
      // Calculate final score: ONLY items that are correct AND did NOT use hints!
      const finalScore = updatedResults.filter(r => r.isCorrect && !r.hintUsed).length;
      
      // Dispatch result to Parent scorecards database
      const attempt: TestAttempt = {
        id: `test-${Date.now()}`,
        listId: selectedList.id,
        listTitle: selectedList.week,
        date: new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }),
        score: finalScore,
        total: selectedList.items.length,
        mode: practiceMode as "spelling" | "vocabulary",
        results: updatedResults
      };
      
      onCompleteTest(attempt);
      speakText(`Hooray! You finished the test! Your score is ${finalScore} out of ${selectedList.items.length}! Outstanding job!`, 0.85, settings.speechVoice);
    }
  };

  const handleShowHint = () => {
    setShowHint(true);
    setCurrentHintUsed(true); // Hint used! No star for this question.
  };

  const handleOpenDictionary = () => {
    setShowDictionary(true);
    setCurrentHintUsed(true); // Definition lookup is also a hint! No star for this question.
  };

  // Generate visual hint blanks (e.g. "d _ v _ l _ p")
  const renderVisualBlanks = (word: string) => {
    const wordLength = word.length;
    
    let stageTitle = "🌟 Beginner Level (Extra Letter Hints!)";
    let stageDesc = "We gave you extra letters to help you get started!";
    if (spellingDifficulty === "intermediate") {
      stageTitle = "🚀 Intermediate Level (Growing Stronger!)";
      stageDesc = "Only the first and last letters are shown.";
    } else if (spellingDifficulty === "advanced") {
      stageTitle = "👑 Advanced Level (Spelling Wizard!)";
      stageDesc = "No letters shown. Pure spelling memory!";
    }

    return (
      <div className="space-y-3 mt-4 text-center">
        {/* Stage Badge */}
        <div className="inline-flex flex-col items-center px-4 py-1.5 bg-indigo-50/50 border border-indigo-100 rounded-xl">
          <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wide flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-bounce" />
            {stageTitle}
          </span>
          <span className="text-[9px] text-slate-500 font-medium">{stageDesc}</span>
        </div>

        <div className="flex justify-center gap-1.5 flex-wrap font-sans text-2xl sm:text-3xl font-black">
          {word.split("").map((char, index) => {
            let shouldReveal = showHint;
            if (!shouldReveal) {
              if (spellingDifficulty === "beginner") {
                // Beginner: First, last, and middle letters
                const middleIndex = Math.floor(wordLength / 2);
                shouldReveal = index === 0 || index === wordLength - 1 || index === middleIndex;
                if (wordLength <= 4) shouldReveal = true; // Reveal short words completely
              } else if (spellingDifficulty === "intermediate") {
                // Intermediate: First and last letter
                shouldReveal = index === 0 || index === wordLength - 1;
              } else {
                // Advanced: No letters
                shouldReveal = false;
              }
            }

            return (
              <div
                key={index}
                className={`w-14 h-16 sm:w-16 sm:h-20 flex items-center justify-center rounded-2xl border-3 transition-all ${
                  shouldReveal 
                    ? "bg-indigo-50 border-indigo-400 text-indigo-700 font-extrabold scale-105" 
                    : "bg-white border-slate-250 text-slate-300"
                }`}
              >
                {shouldReveal ? char : "_"}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const handleExitPractice = () => {
    setShowExitConfirm(true);
  };

  return (
    <div className="w-full flex flex-col items-center" id="child-dashboard-root">
      
      {/* Friendly Primary Teacher Greeting Bubble */}
      {!isCompleted && (
        <div className="w-full max-w-2xl bg-slate-900 border-2 border-yellow-400 p-5 rounded-3xl mb-6 shadow-md flex items-start gap-4 relative overflow-hidden text-white">
          {/* Checkered flag banner effect */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-[repeating-linear-gradient(45deg,#000,#000_10px,#fff_10px,#fff_20px)] opacity-30"></div>
          <div className="absolute right-2 bottom-2 text-7xl opacity-10 select-none">🍌</div>
          <div className="w-14 h-14 rounded-2xl bg-yellow-400 flex items-center justify-center text-4xl shadow-sm flex-shrink-0 border-2 border-white animate-bounce">
            🍌
          </div>
          <div className="space-y-1">
            <h4 className="font-black text-sm text-yellow-400 flex items-center gap-2 tracking-wide uppercase">
              <span>Mr Minions (Spelling Coach)</span>
              <span className="bg-red-600 text-white text-[9px] px-2 py-0.5 rounded-md font-black tracking-widest animate-pulse">
                🏎️ F1 COACH
              </span>
            </h4>
            <p className="text-xs text-slate-200 leading-relaxed font-medium">
              "Bello {settings.childName || "Super Kid"}! I'm your racing coach, Mr Minions! 🍌 Ready to put your spelling into full throttle? Let's zoom through these words! Earn gold trophies and speed stars as you race to the checkered flag! Remember, avoiding hints gets you the pole position! Box Box, let's start the engine! 🏎️💨"
            </p>
          </div>
        </div>
      )}

      {/* 1. SELECTION STATE: CHOOSE SPELLING LIST */}
      {!selectedList && (
        <div className="w-full space-y-6">
          <div className="text-center space-y-2">
            <span className="text-4xl">{avatarEmoji}</span>
            <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">
              Ready to learn, Super Kid?
            </h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Select your spelling worksheet list below to start practicing for your school test!
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {spellingLists
              .filter((list) => {
                const listIsChinese = list.language === "zh" || list.items.some(item => /[\u4e00-\u9fa5]/.test(item.word));
                return !listIsChinese;
              })
              .map((list) => (
                <button
                   key={list.id}
                   onClick={() => handleSelectList(list)}
                   className="bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-400 p-5 rounded-2xl text-left shadow-xs transition-all group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                        {list.items.length} Spelling Words
                      </span>
                      {list.date && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {list.date}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-black text-slate-800 group-hover:text-indigo-600 transition-colors">
                      {list.week}
                    </h3>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {list.items.slice(0, 5).map((item) => (
                        <span key={item.id} className="bg-slate-100 text-slate-600 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                          {item.word}
                        </span>
                      ))}
                      {list.items.length > 5 && (
                        <span className="text-[10px] text-slate-400 font-bold self-center ml-1">
                          +{list.items.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500 group-hover:text-indigo-600 transition-colors">
                    <span>Start Practice</span>
                    <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              ))}

            {spellingLists.filter((list) => {
              const listIsChinese = list.language === "zh" || list.items.some(item => /[\u4e00-\u9fa5]/.test(item.word));
              return !listIsChinese;
            }).length === 0 && (
              <div className="col-span-full py-16 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-slate-500 font-bold">
                  No English spelling lists found. Switch to the Parent dashboard to create one!
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. MODE CHOOSER STATE */}
      {selectedList && !practiceMode && !isChoosingDifficulty && (
        <div className="w-full max-w-2xl space-y-6">
          <button
            onClick={() => setSelectedList(null)}
            className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to All Lists
          </button>

          <div className="text-center space-y-2 bg-slate-900 text-white p-6 rounded-3xl border-2 border-yellow-400 shadow-md relative overflow-hidden">
            {/* Checkered flag banner effect */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-[repeating-linear-gradient(45deg,#000,#000_10px,#fff_10px,#fff_20px)] opacity-30"></div>
            <h3 className="text-xl font-black text-yellow-400 flex items-center justify-center gap-1.5 uppercase tracking-wide">
              🏎️ {selectedList.week}
            </h3>
            {selectedList.date && <p className="text-xs text-slate-300">Grand Prix Date: {selectedList.date}</p>}
            <p className="text-xs font-bold text-slate-900 bg-yellow-400 inline-block px-4 py-1 rounded-full mt-2 border border-white">
              🏁 {selectedList.items.length} Racing Laps to Complete
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Mode 1: Flashcards / Study */}
            <button
              onClick={() => handleStartPractice("flashcard")}
              className="bg-white hover:bg-slate-50 border border-slate-200 hover:border-amber-400 p-5 rounded-2xl shadow-3xs text-center flex flex-col justify-between transition-all group"
            >
              <div className="space-y-3">
                <span className="text-3xl block">🚦</span>
                <h4 className="font-bold text-slate-800 group-hover:text-amber-600 transition-colors">1. Free Practice Lap</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Look at each spelling word, hear how it sounds, and read the sentence to memorize the racing lines!
                </p>
              </div>
              <span className="mt-4 text-xs font-bold text-amber-600 flex items-center justify-center gap-1">
                Study Words <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>

            {/* Mode 2: Word Practice */}
            <button
              onClick={() => handleStartPractice("spelling")}
              className="bg-white hover:bg-slate-50 border border-slate-200 hover:border-red-500 p-5 rounded-2xl shadow-3xs text-center flex flex-col justify-between transition-all group"
            >
              <div className="space-y-3">
                <span className="text-3xl block">🏎️</span>
                <h4 className="font-bold text-slate-800 group-hover:text-red-600 transition-colors">2. Speed Time Trial</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Listen to pronunciation, type the word, and select Beginner, Intermediate or Pro difficulty!
                </p>
              </div>
              <span className="mt-4 text-xs font-bold text-red-600 flex items-center justify-center gap-1">
                Start Spelling <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>

            {/* Mode 3: Vocabulary Quiz (MCQ & Cloze) */}
            <button
              onClick={() => handleStartPractice("vocabulary")}
              className="bg-white hover:bg-slate-50 border border-slate-200 hover:border-yellow-500 p-5 rounded-2xl shadow-3xs text-center flex flex-col justify-between transition-all group"
            >
              <div className="space-y-3">
                <span className="text-3xl block">🏆</span>
                <h4 className="font-bold text-slate-800 group-hover:text-yellow-600 transition-colors">3. Grand Prix Quiz</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Choose similar meanings (Synonyms), opposite meanings (Antonyms), and fill-in track blanks!
                </p>
              </div>
              <span className="mt-4 text-xs font-bold text-yellow-600 flex items-center justify-center gap-1">
                Start Quiz <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>
          </div>
        </div>
      )}

      {/* SPELLING DIFFICULTY CHOICE POPUP */}
      {selectedList && isChoosingDifficulty && (
        <div className="w-full max-w-md bg-slate-900 border-2 border-yellow-400 p-6 rounded-3xl shadow-lg text-center space-y-6 text-white relative overflow-hidden">
          {/* Checkered track banner */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-[repeating-linear-gradient(45deg,#000,#000_10px,#fff_10px,#fff_20px)] opacity-30"></div>
          <div className="w-14 h-14 rounded-full bg-yellow-400 text-slate-950 flex items-center justify-center text-3xl mx-auto border-2 border-white animate-pulse">
            🏎️
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-black text-yellow-400 uppercase tracking-wide">Select Spelling Engine Speed</h3>
            <p className="text-xs text-slate-300">
              Coach Mr Minions wants you to choose a racing speed for your spelling engine:
            </p>
          </div>

          <div className="space-y-3 text-left">
            <button
              onClick={() => {
                setSpellingDifficulty("beginner");
                startSession("spelling");
              }}
              className="w-full bg-slate-800 hover:bg-slate-750 border-2 border-slate-700 hover:border-yellow-400 p-4 rounded-2xl text-left flex items-start gap-3.5 transition-all group"
            >
              <span className="text-2xl mt-0.5">🚥</span>
              <div>
                <h4 className="font-black text-sm text-yellow-400 group-hover:text-yellow-300">Beginner Lap (新手暖胎)</h4>
                <p className="text-[11px] text-slate-300 leading-relaxed mt-0.5">
                  First, middle, and last letters are revealed. Extra racing lines are visible. Perfect for warm-up!
                </p>
              </div>
            </button>

            <button
              onClick={() => {
                setSpellingDifficulty("intermediate");
                startSession("spelling");
              }}
              className="w-full bg-slate-800 hover:bg-slate-750 border-2 border-slate-700 hover:border-yellow-400 p-4 rounded-2xl text-left flex items-start gap-3.5 transition-all group"
            >
              <span className="text-2xl mt-0.5">🚀</span>
              <div>
                <h4 className="font-black text-sm text-yellow-400 group-hover:text-yellow-300">Turbo Mode (中级排位赛)</h4>
                <p className="text-[11px] text-slate-300 leading-relaxed mt-0.5">
                  Only the first letter and last letter are revealed. A great way to test your grip on the track!
                </p>
              </div>
            </button>

            <button
              onClick={() => {
                setSpellingDifficulty("advanced");
                startSession("spelling");
              }}
              className="w-full bg-slate-800 hover:bg-slate-750 border-2 border-slate-700 hover:border-yellow-400 p-4 rounded-2xl text-left flex items-start gap-3.5 transition-all group"
            >
              <span className="text-2xl mt-0.5">🏆</span>
              <div>
                <h4 className="font-black text-sm text-yellow-400 group-hover:text-yellow-300">Pro Grand Prix (高级大奖赛)</h4>
                <p className="text-[11px] text-slate-300 leading-relaxed mt-0.5">
                  No visual helpers at all! Only empty track spaces. The ultimate test of spelling speed!
                </p>
              </div>
            </button>
          </div>

          <button
            onClick={() => setIsChoosingDifficulty(false)}
            className="text-xs font-bold text-slate-400 hover:text-white pt-2 block mx-auto transition-colors"
          >
            Cancel and Go Back to Pits
          </button>
        </div>
      )}

      {/* 3. CORE RUNNING INTERFACE */}
      {selectedList && practiceMode && !isCompleted && (
        <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs relative">
          
          {/* Practice Header Controls */}
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <button
              onClick={handleExitPractice}
              className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-600"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Stop Session
            </button>

            {/* Quick Word Dictionary button - clickable dictionary lookup */}
            <button
              type="button"
              onClick={handleOpenDictionary}
              className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1 rounded-xl text-[11px] font-extrabold shadow-3xs"
            >
              <Book className="w-3.5 h-3.5" />
              💡 Word Dictionary (看词义)
            </button>

            <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
              Question {currentIndex + 1} / {selectedList.items.length}
            </span>
          </div>

          {/* DICTIONARY OVERLAY / TOOLTIP POPUP */}
          {showDictionary && (
            <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full shadow-lg space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">📖</span>
                    <div>
                      <h4 className="font-extrabold text-base text-slate-800">
                        "{selectedList.items[currentIndex].word}"
                      </h4>
                      <p className="text-[10px] text-indigo-600 uppercase font-black tracking-widest">
                        Word Dictionary Definition
                      </p>
                    </div>
                  </div>
                  <span className="bg-red-50 text-red-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-red-100">
                    No Star Awarded
                  </span>
                </div>

                <div className="space-y-3 pt-2 text-xs">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-150">
                    <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">Kid-friendly Definition</span>
                    <p className="font-semibold text-slate-700 leading-relaxed">
                      {selectedList.items[currentIndex].definition || "No definition specified. Use context clues to figure out this spelling word!"}
                    </p>
                  </div>

                  {selectedList.items[currentIndex].synonyms && selectedList.items[currentIndex].synonyms!.length > 0 && (
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">Synonyms (近义词)</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedList.items[currentIndex].synonyms!.map((syn, idx) => (
                          <span key={idx} className="bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold px-2.5 py-0.5 rounded-md">
                            {syn}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedList.items[currentIndex].antonyms && selectedList.items[currentIndex].antonyms!.length > 0 && (
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">Antonyms (反义词)</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedList.items[currentIndex].antonyms!.map((ant, idx) => (
                          <span key={idx} className="bg-pink-50 text-pink-700 border border-pink-100 font-bold px-2.5 py-0.5 rounded-md">
                            {ant}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-[10px] text-amber-600 leading-relaxed mt-2 italic">
                    💡 Note: To be fair, looking up the meaning of a word acts as a helper, so you won't earn a gold star for this word this time. Try memorizing it for next time!
                  </p>
                </div>

                <button
                  onClick={() => setShowDictionary(false)}
                  className="w-full bg-slate-850 hover:bg-slate-900 text-white text-xs font-bold py-2.5 rounded-xl mt-4"
                >
                  I Understand, Let's Practice!
                </button>
              </div>
            </div>
          )}

          {/* FLASHCARD MODE INTERFACE */}
          {practiceMode === "flashcard" ? (
            <div className="space-y-6 py-6 text-center">
              <div className="bg-gradient-to-tr from-slate-50 to-indigo-50/20 border border-slate-200 rounded-2xl p-6 shadow-3xs inline-block w-full">
                <span className="text-xs text-indigo-500 font-extrabold uppercase tracking-widest block mb-2">SPELLING WORD</span>
                <h2 className="text-5xl sm:text-7xl font-black text-indigo-700 tracking-wide font-sans py-3 select-all">
                  {selectedList.items[currentIndex].word}
                </h2>

                <div className="flex justify-center gap-2 mt-4">
                  <button
                    onClick={handleSpeakWordOnly}
                    disabled={isSpeaking}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all"
                  >
                    <Volume2 className="w-4 h-4" />
                    Hear Word
                  </button>
                  <button
                    onClick={handleSpeakSentenceOnly}
                    disabled={isSpeaking}
                    className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl transition-all border border-slate-200"
                  >
                    <Volume2 className="w-4 h-4" />
                    Hear Sentence
                  </button>
                </div>
              </div>

              {/* Kid-friendly Meaning and Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto text-left">
                <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl">
                  <span className="text-[10px] text-slate-400 font-extrabold block tracking-wide uppercase mb-1">School Sentence</span>
                  <p className="text-xs font-semibold text-slate-700 italic leading-relaxed">
                    "{selectedList.items[currentIndex].text}"
                  </p>
                </div>

                <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl">
                  <span className="text-[10px] text-amber-700 font-extrabold block tracking-wide uppercase mb-1">What does it mean?</span>
                  <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                    {selectedList.items[currentIndex].definition || "No custom meaning yet."}
                  </p>
                </div>
              </div>

              {/* Navigation for Flashcards */}
              <div className="flex items-center justify-between pt-4 max-w-sm mx-auto">
                <button
                  onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                  className="flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-600 px-3.5 py-2 rounded-xl text-xs font-bold"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>

                <span className="text-xs font-bold text-slate-400">
                  {currentIndex + 1} of {selectedList.items.length}
                </span>

                {currentIndex < selectedList.items.length - 1 ? (
                  <button
                    onClick={() => setCurrentIndex(prev => prev + 1)}
                    className="flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setIsCompleted(true);
                      speakText("Excellent study! You are fully prepared to start the typing tests!", 0.85, settings.speechVoice);
                    }}
                    className="flex items-center justify-center gap-1 bg-gradient-to-tr from-indigo-600 to-pink-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
                  >
                    Finish Study <Trophy className="w-4 h-4 ml-1" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            // RUNNING PRACTICE INTERFACE (SPELLING OR VOCABULARY QUIZ)
            <div className="space-y-6">
              
              {/* SPELLING MODE RUNNER */}
              {practiceMode === "spelling" && (
                <div className="space-y-6">
                  {/* Question Audio Box */}
                  <div className="text-center p-5 bg-gradient-to-br from-indigo-50/50 to-pink-50/20 border border-slate-150 rounded-2xl">
                    <span className="text-xs text-slate-400 block font-bold mb-2">Listen to spelling audio:</span>
                    
                    <button
                      id="child-repeat-dictation-btn"
                      onClick={() => playQuestionAudio(selectedList.items[currentIndex])}
                      disabled={isSpeaking}
                      className="w-16 h-16 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white shadow-md flex items-center justify-center mx-auto hover:scale-105 transition-all"
                      title="Repeat Pronunciation"
                    >
                      <Volume2 className="w-8 h-8" />
                    </button>

                    <p className="text-xs text-slate-500 font-semibold mt-3">
                      {isSpeaking ? "Speaking aloud..." : "Click to hear word + school sentence"}
                    </p>

                    {/* Speech Speed Quick Adjuster slider! Directly right under the audio button for high visibility & instant ease of use! */}
                    <div className="max-w-xs mx-auto mt-4 pt-4 border-t border-slate-200/50 flex flex-col items-center gap-1.5">
                      <div className="flex justify-between w-full text-[11px] font-black text-slate-600">
                        <span>🔊 Speech Speed (语速):</span>
                        <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md font-extrabold">{settings.speechRate}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.4"
                        max="1.2"
                        step="0.05"
                        value={settings.speechRate}
                        onChange={(e) => {
                          if (onUpdateSettings) {
                            onUpdateSettings(prev => ({ ...prev, speechRate: parseFloat(e.target.value) }));
                          }
                        }}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                      <div className="flex justify-between w-full text-[9px] font-bold text-slate-400">
                        <span>Slow (较慢 0.4x)</span>
                        <span>Normal (正常 1.0x)</span>
                        <span>Fast (较快 1.2x)</span>
                      </div>
                    </div>

                    {renderVisualBlanks(selectedList.items[currentIndex].word)}
                  </div>

                  {/* KEYBOARD MODE INPUT */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide">
                      Type spelling answer:
                    </label>

                    <input
                      id="child-typed-input"
                      type="text"
                      autoFocus
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      value={typedAnswer}
                      onChange={(e) => setTypedAnswer(e.target.value)}
                      disabled={hasChecked && isCorrect}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && typedAnswer.trim() && !(hasChecked && isCorrect)) {
                          checkAnswer();
                        }
                      }}
                      placeholder="Type spelling word..."
                      className="w-full font-sans text-center text-3xl sm:text-4xl font-extrabold border-3 border-indigo-200 focus:border-indigo-500 rounded-2xl px-5 py-4 focus:outline-hidden focus:ring-4 focus:ring-indigo-100 bg-indigo-50/10 focus:bg-white shadow-xs transition-all text-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* VOCABULARY MODE RUNNER (MCQ INTERFACE) */}
              {practiceMode === "vocabulary" && vocabQuestion && (
                <div className="space-y-6">
                  {/* Dynamic Teacher Question Panel */}
                  <div className="p-5 bg-gradient-to-br from-yellow-50/80 via-amber-50/50 to-red-50/20 border border-yellow-200 rounded-2xl relative">
                    <span className="text-xs text-yellow-700 font-extrabold uppercase tracking-wider block mb-2 flex items-center gap-1">
                      🏁 Mr Minions' {vocabQuestion.type === "fill-in" ? "Super Turbo Cloze Game 📝" : "Formula 1 Meaning Matcher 🔍"}
                    </span>
                    <p className="text-sm font-bold text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {vocabQuestion.questionText}
                    </p>

                    <button
                      onClick={() => playQuestionAudio(selectedList.items[currentIndex])}
                      disabled={isSpeaking}
                      className="mt-3.5 flex items-center gap-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-black px-2.5 py-1 rounded-md"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-indigo-500" /> Read Question Aloud
                    </button>
                  </div>

                  {/* Multiple Choice Options Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {vocabQuestion.options.map((option, idx) => {
                      const isSelected = typedAnswer === option;
                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={hasChecked}
                          onClick={() => checkAnswer(option)}
                          className={`p-4 rounded-xl text-left border-2 text-xs font-extrabold transition-all duration-150 flex items-center gap-3.5 ${
                            hasChecked
                              ? option === vocabQuestion.correctAnswer
                                ? "bg-emerald-50 border-emerald-400 text-emerald-800 shadow-3xs"
                                : isSelected
                                ? "bg-red-50 border-red-300 text-red-800"
                                : "bg-slate-50 border-slate-100 text-slate-400"
                              : isSelected
                              ? "bg-indigo-50 border-indigo-500 text-indigo-800 scale-[1.01]"
                              : "bg-white hover:bg-indigo-50/20 border-slate-200 text-slate-700 hover:border-slate-350"
                          }`}
                        >
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-black ${
                            hasChecked
                              ? option === vocabQuestion.correctAnswer
                                ? "bg-emerald-100 text-emerald-800"
                                : isSelected
                                ? "bg-red-100 text-red-800"
                                : "bg-slate-100 text-slate-400"
                              : isSelected
                              ? "bg-indigo-600 text-white animate-bounce"
                              : "bg-slate-100 text-slate-600"
                          }`}>
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span className="flex-1 font-sans">{option}</span>
                          {hasChecked && option === vocabQuestion.correctAnswer && (
                            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Interactive Hints/Controls Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div>
                  {practiceMode === "spelling" && !hasChecked && (
                    <button
                      type="button"
                      onClick={handleShowHint}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100"
                    >
                      <HelpCircle className="w-4 h-4 text-indigo-500" />
                      {showHint ? "Letter hints are visible!" : "Need help? Reveal letter boxes (-0 stars)"}
                    </button>
                  )}
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  {/* Render Check Answer Button ONLY for Spelling Mode */}
                  {practiceMode === "spelling" && !hasChecked && (
                    <button
                      id="child-check-answer-btn"
                      type="button"
                      disabled={!typedAnswer.trim()}
                      onClick={() => checkAnswer()}
                      className="w-full sm:w-auto bg-slate-800 hover:bg-slate-900 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold py-2.5 px-6 rounded-xl shadow-3xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Check className="w-4 h-4" />
                      Check Spelling
                    </button>
                  )}

                  {hasChecked && (
                    <div className="flex gap-2 w-full">
                      {!isCorrect && attempts < 3 && (
                        <button
                          id="child-retry-btn"
                          type="button"
                          onClick={() => setHasChecked(false)}
                          className="flex-1 sm:flex-none bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 px-5 rounded-xl border border-slate-200 flex items-center justify-center gap-1.5"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Try Again
                        </button>
                      )}
                      
                      {/* Show reveal option if incorrect */}
                      {!isCorrect && (
                        <button
                          type="button"
                          onClick={() => {
                            const ans = practiceMode === "spelling" ? selectedList.items[currentIndex].word : vocabQuestion?.correctAnswer || "";
                            setTypedAnswer(ans);
                            setHasChecked(false);
                            setIsCorrect(true);
                            setCurrentHintUsed(true); // Reveal counts as hint
                          }}
                          className="text-xs text-red-500 hover:text-red-700 font-bold px-2"
                        >
                          Reveal Answer
                        </button>
                      )}

                      {(isCorrect || attempts >= 3) && (
                        <button
                          id="child-next-question-btn"
                          type="button"
                          onClick={handleNext}
                          className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-6 rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all"
                        >
                          Next Question
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Feedback Alert Screen */}
              {hasChecked && (
                <div className={`p-4 rounded-xl border flex items-start gap-3 mt-4 ${
                  isCorrect 
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                    : "bg-red-50 border-red-200 text-red-800"
                }`}>
                  <span className="text-xl leading-none mt-0.5">{isCorrect ? "🎉" : "💡"}</span>
                  <div className="flex-1">
                    <h4 className="font-extrabold text-xs">
                      {isCorrect ? "Fantastic! " + currentEncouragement : "Not quite! " + currentEncouragement}
                    </h4>
                    
                    {isCorrect && (
                      <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5 font-bold">
                        {currentHintUsed ? (
                          <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-sm border border-amber-100">
                            ⭐ Hint Used! You learned a new word, but no gold star is earned this time. Try again later!
                          </span>
                        ) : (
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-sm border border-emerald-100 flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-bounce" /> Correct without hints! +1 Gold Star Earned!
                          </span>
                        )}
                      </p>
                    )}

                    {!isCorrect && (
                      <p className="text-xs text-slate-600 mt-1">
                        Correct answer was: <strong className="font-mono text-xs text-indigo-600">{practiceMode === "spelling" ? selectedList.items[currentIndex].word : vocabQuestion?.correctAnswer}</strong>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. CONGRATULATIONS / SCORECARD SCREEN */}
      {selectedList && isCompleted && (
        <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 shadow-xs text-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center text-4xl mx-auto shadow-md border border-amber-100">
              🏆
            </div>
            <span className="absolute -top-1 -right-1 text-2xl animate-bounce">✨</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-800">Outstanding job!</h2>
            <p className="text-sm text-slate-500">
              You've completed your weekly spelling list for <strong>{selectedList.week}</strong>!
            </p>
          </div>

          {/* Practice Summary Report */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl max-w-sm mx-auto flex items-center justify-around gap-4">
            <div className="text-center">
              <span className="text-3xl font-black text-indigo-600 block">
                {testResults.filter(r => r.isCorrect).length} / {selectedList.items.length}
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-wide block">Words Correct</span>
            </div>

            <div className="w-px h-10 bg-slate-200"></div>

            <div className="text-center">
              <span className="text-3xl font-black text-amber-500 block">
                +{testResults.filter(r => r.isCorrect && !r.hintUsed).length} ✨
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-wide block">Gold Stars Earned</span>
            </div>
          </div>

          {/* Inform child about points deduction for hints */}
          {testResults.some(r => r.hintUsed) && (
            <p className="text-[10px] text-amber-600 leading-relaxed italic max-w-xs mx-auto">
              🏎️ Coach Mr Minions says: "Bello! Great effort! You took a quick pit stop for letter hints or dictionary lookups. Study the track again to earn the maximum speed stars next lap! 🏁"
            </p>
          )}

          {/* Certificate Badge Selection */}
          <div className="space-y-2 pt-2">
            <p className="text-xs font-bold text-slate-500">Choose your virtual reward badge:</p>
            <div className="flex justify-center gap-2">
              <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full text-xs font-black shadow-3xs flex items-center gap-1.5">
                🎖️ Word Wizard
              </span>
              <span className="bg-pink-50 border border-pink-100 text-pink-700 px-3 py-1.5 rounded-full text-xs font-black shadow-3xs flex items-center gap-1.5">
                👑 Spelling King
              </span>
              <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-black shadow-3xs flex items-center gap-1.5">
                🚀 Star Learner
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-4">
            <button
              id="child-return-dashboard-btn"
              onClick={() => {
                setSelectedList(null);
                setPracticeMode(null);
                setIsCompleted(false);
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-3 rounded-xl shadow-xs transition-all"
            >
              Start Another List
            </button>
            <button
              id="child-study-again-btn"
              onClick={() => {
                setPracticeMode(null);
                setIsCompleted(false);
              }}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-3 rounded-xl border border-slate-200 transition-all"
            >
              Study This List Again
            </button>
          </div>
        </div>
      )}

      {/* 4. CUSTOM MIDWAY EXIT CONFIRMATION MODAL */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-yellow-400 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-6 text-center text-white relative overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Checkered flag banner effect */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-[repeating-linear-gradient(45deg,#000,#000_10px,#fff_10px,#fff_20px)] opacity-30"></div>
            
            <div className="w-16 h-16 rounded-full bg-yellow-400 text-slate-950 flex items-center justify-center text-4xl mx-auto border-2 border-white animate-bounce mt-2">
              🏎️
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-yellow-400 uppercase tracking-wide">
                Box, Box! Pit Stop?
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                Coach Mr Minions asks: "Are you sure you want to pull into the pit lane? Your spelling race progress on this track will not be saved!"
              </p>
              <p className="text-[11px] text-yellow-300 font-bold italic">
                (中途退出将无法保存当前关卡的练习记录哦，确定要退出吗？)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  setShowExitConfirm(false);
                  setPracticeMode(null);
                }}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-black py-3 px-4 rounded-xl shadow-md transition-all uppercase tracking-wider border border-red-500 hover:scale-[1.02]"
              >
                🏁 Quit / 退出比赛
              </button>
              <button
                onClick={() => setShowExitConfirm(false)}
                className="bg-yellow-400 hover:bg-yellow-500 text-slate-950 text-xs font-black py-3 px-4 rounded-xl shadow-md transition-all uppercase tracking-wider border border-white hover:scale-[1.02]"
              >
                🏎️ Keep Racing / 继续比赛
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
