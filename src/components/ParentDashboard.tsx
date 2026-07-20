import React, { useState, useRef } from "react";
import {
  SpellingList,
  SpellingItem,
  TestAttempt
} from "../types";
import {
  Upload,
  Plus,
  Trash2,
  Edit2,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Award,
  BookOpen,
  ArrowRight,
  Eye,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { computeSentenceDiff } from "../utils";

interface ParentDashboardProps {
  spellingLists: SpellingList[];
  setSpellingLists: React.Dispatch<React.SetStateAction<SpellingList[]>>;
  testAttempts: TestAttempt[];
  clearHistory: () => void;
  childName: string;
  wrongWords: SpellingItem[];
  onRemoveWrongWord: (word: string) => void;
  onClearWrongWords: () => void;
}

export default function ParentDashboard({
  spellingLists,
  setSpellingLists,
  testAttempts,
  clearHistory,
  childName,
  wrongWords,
  onRemoveWrongWord,
  onClearWrongWords
}: ParentDashboardProps) {
  // Tabs for Parent Dashboard
  const [activeTab, setActiveTab] = useState<"lists" | "history" | "analytics" | "notebook">("lists");

  // Manual list creator / editor state
  const [isCreating, setIsCreating] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [listWeek, setListWeek] = useState("");
  const [listDate, setListDate] = useState("");
  const [listItems, setListItems] = useState<SpellingItem[]>([]);
  const [listLanguage, setListLanguage] = useState<"en" | "zh">("zh");

  // AI Scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Spelling List Generator state
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [generatorText, setGeneratorText] = useState("");
  const [generatorLanguage, setGeneratorLanguage] = useState<"en" | "zh">("zh");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const textFileInputRef = useRef<HTMLInputElement>(null);

  // Previewing list details
  const [previewListId, setPreviewListId] = useState<string | null>(null);

  // Calculate high level analytics
  const totalStars = testAttempts.reduce((sum, item) => sum + (item.score), 0);
  const totalTests = testAttempts.length;
  const avgScore = totalTests > 0 
    ? Math.round((testAttempts.reduce((sum, item) => sum + (item.score / item.total), 0) / totalTests) * 100) 
    : 0;

  // Track words that were missed
  const missedWordCounts: { [word: string]: { count: number; sentence: string; listTitle: string } } = {};
  testAttempts.forEach(attempt => {
    attempt.results.forEach(res => {
      if (!res.isCorrect) {
        const key = res.word.toLowerCase().trim();
        if (!missedWordCounts[key]) {
          missedWordCounts[key] = {
            count: 0,
            sentence: res.text,
            listTitle: attempt.listTitle
          };
        }
        missedWordCounts[key].count += 1;
      }
    });
  });
  
  const problemWords = Object.entries(missedWordCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6);

  // File Upload base64 reader for AI scan
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (< 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setScanError("Image file is too large. Please select an image under 10MB.");
      return;
    }

    setScanError(null);
    setIsScanning(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64String = (reader.result as string).split(",")[1];
        
        // Post base64 image and mimeType to our custom Express proxy API
        const response = await fetch("/api/gemini/extract", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            image: base64String,
            mimeType: file.type
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to process the spelling sheet.");
        }

        // Successfully extracted! Fill into the form
        setListWeek(data.week || `Scanned Week`);
        setListDate(data.date || "");
        
        // Ensure standard structure for items
        const formattedItems = (data.items || []).map((item: any, index: number) => ({
          id: item.id || index + 1,
          word: (item.word || "").toLowerCase().trim(),
          text: item.text || ""
        }));

        const containsChinese = formattedItems.some((item: any) => /[\u4e00-\u9fa5]/.test(item.word));
        setListLanguage(containsChinese ? "zh" : "en");

        setListItems(formattedItems);
        setIsCreating(true);
        setEditingListId(null); // It's a brand new list
        setActiveTab("lists");
        
      } catch (err: any) {
        console.error(err);
        setScanError(err.message || "Something went wrong scanning. Try typing manual lists or verify your Gemini Secret Key.");
      } finally {
        setIsScanning(false);
      }
    };

    reader.readAsDataURL(file);
  };

  // Text File Upload Reader for AI Generation
  const handleTextFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setGeneratorText(content);
    };
    reader.readAsText(file);
  };

  // Call API to generate spelling list with AI sentences and definitions
  const handleAIGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!generatorText.trim()) {
      setGenerationError("Please enter some spelling words or upload a text file.");
      return;
    }

    setGenerationError(null);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/gemini/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: generatorText,
          language: generatorLanguage
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate spelling practice list.");
      }

      setListWeek(data.week || `Next Week's Practice - 下周听写`);
      setListDate("");
      
      const formattedItems = (data.items || []).map((item: any, index: number) => ({
        id: item.id || index + 1,
        word: (item.word || "").trim(),
        text: item.text || "",
        definition: item.definition || "",
        synonyms: item.synonyms || [],
        antonyms: item.antonyms || []
      }));

      setListItems(formattedItems);
      setListLanguage(generatorLanguage);
      setIsCreating(true);
      setEditingListId(null); // brand new list
      setIsGeneratingAI(false); // close generator view
      setGeneratorText(""); // clear input
    } catch (err: any) {
      console.error(err);
      setGenerationError(err.message || "Something went wrong generating. Please verify your Gemini Secret Key.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Manual creation actions
  const startNewManualList = () => {
    setListWeek(`Week ${spellingLists.length + 1} - Spelling ${spellingLists.length + 8}`);
    setListDate("");
    setListItems([
      { id: 1, word: "", text: "" }
    ]);
    setListLanguage("zh"); // default to Chinese list
    setEditingListId(null);
    setIsCreating(true);
  };

  const editExistingList = (list: SpellingList) => {
    setListWeek(list.week);
    setListDate(list.date || "");
    setListItems([...list.items]);
    const isZh = list.language === "zh" || list.items.some(item => /[\u4e00-\u9fa5]/.test(item.word));
    setListLanguage(isZh ? "zh" : "en");
    setEditingListId(list.id);
    setIsCreating(true);
  };

  const deleteList = (id: string) => {
    if (confirm("Are you sure you want to delete this spelling list?")) {
      setSpellingLists(prev => prev.filter(l => l.id !== id));
      if (previewListId === id) setPreviewListId(null);
    }
  };

  const handleAddItem = () => {
    setListItems(prev => [
      ...prev,
      { id: prev.length + 1, word: "", text: "" }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setListItems(prev => {
      const updated = prev.filter((_, i) => i !== index);
      // Re-assign ids 1-based
      return updated.map((item, idx) => ({ ...item, id: idx + 1 }));
    });
  };

  const handleItemChange = (index: number, field: "word" | "text", value: string) => {
    setListItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const saveSpellingList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!listWeek.trim()) {
      alert("Please provide a name or week title for the list.");
      return;
    }

    // Filter out completely empty items
    const validatedItems = listItems
      .filter(item => item.word.trim() !== "")
      .map((item, idx) => ({
        id: idx + 1,
        word: item.word.toLowerCase().trim(),
        text: item.text.trim() || `Listen and write the word ${item.word}.`
      }));

    if (validatedItems.length === 0) {
      alert("The spelling list must have at least 1 word.");
      return;
    }

    const savedList: SpellingList = {
      id: editingListId || `list-${Date.now()}`,
      week: listWeek.trim(),
      date: listDate.trim() || undefined,
      items: validatedItems,
      language: listLanguage
    };

    setSpellingLists(prev => {
      if (editingListId) {
        // Update existing
        return prev.map(l => l.id === editingListId ? savedList : l);
      } else {
        // Insert new
        return [savedList, ...prev];
      }
    });

    setIsCreating(false);
    setEditingListId(null);
    alert(editingListId ? "Spelling list updated successfully!" : "New spelling list added!");
  };

  return (
    <div className="w-full" id="parent-dashboard-root">
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 mb-6 gap-2 flex-wrap">
        <button
          id="parent-tab-lists"
          onClick={() => { setActiveTab("lists"); setIsCreating(false); }}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "lists"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Spelling Lists
        </button>
        <button
          id="parent-tab-history"
          onClick={() => { setActiveTab("history"); setIsCreating(false); }}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "history"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Clock className="w-4 h-4" />
          Test History & Scorecards
        </button>
        <button
          id="parent-tab-analytics"
          onClick={() => { setActiveTab("analytics"); setIsCreating(false); }}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "analytics"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Learning Insights
        </button>
        <button
          id="parent-tab-notebook"
          onClick={() => { setActiveTab("notebook"); setIsCreating(false); }}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "notebook"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span className="text-sm">🚨</span>
          错题本 / Mistake Notebook ({wrongWords.length})
        </button>
      </div>

      {/* TABS CONTENT */}

      {/* TAB 1: SPELLING LISTS */}
      {activeTab === "lists" && (
        <div className="space-y-6">
          {/* Main Action Banner */}
          {!isCreating && !isGeneratingAI && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Magic Image Upload Scanner */}
              <div className="p-5 bg-gradient-to-br from-indigo-50 to-pink-50 border border-indigo-100 rounded-2xl flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-indigo-500 text-white rounded-lg">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800">
                      AI Spelling Sheet Scanner
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                    Simply take a photo of your son's spelling homework list (just like you did in the chat!), upload it, and Gemini will automatically extract the words and dictation sentences for interactive test preparation!
                  </p>
                </div>

                <div>
                  {/* File Upload Button */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                    id="parent-scan-file-input"
                  />
                  <button
                    id="parent-scan-trigger-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanning}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-xs transition-all"
                  >
                    {isScanning ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Analyzing spelling sheet...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Scan Worksheet Photo
                      </>
                    )}
                  </button>

                  {scanError && (
                    <div className="mt-2.5 p-2 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600 flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span>{scanError}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Magic AI List Generator */}
              <div className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-2xl flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-amber-500 text-white rounded-lg">
                      <Sparkles className="w-4 h-4 animate-pulse" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800">
                      AI Practice Generator
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                    Paste a list of spelling words (e.g. <i>收拾, 漂亮, 追上, 觉得</i>) or upload a <code>.txt</code> list file. Gemini will automatically generate dictation sentences, definitions, and synonyms for next week's practice!
                  </p>
                </div>

                <button
                  id="parent-generate-ai-trigger-btn"
                  onClick={() => setIsGeneratingAI(true)}
                  className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-xs transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  智能生成下周听写练习
                </button>
              </div>

              {/* Manual List Add */}
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-slate-800 text-white rounded-lg">
                      <Plus className="w-4 h-4" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800">
                      Create Manual Spelling List
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                    Type a new spelling list yourself, inputting custom target spelling words and the full dictation sentences that your son needs to practice.
                  </p>
                </div>

                <button
                  id="parent-add-manual-btn"
                  onClick={startNewManualList}
                  className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-xs transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Type New List Manually
                </button>
              </div>
            </div>
          )}

          {/* AI GENERATION FORM */}
          {isGeneratingAI && (
            <form onSubmit={handleAIGenerate} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  智能生成下周听写练习 (AI Spelling Practice Generator)
                </h3>
                <button
                  id="parent-generator-cancel"
                  type="button"
                  onClick={() => {
                    setIsGeneratingAI(false);
                    setGenerationError(null);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
                >
                  Cancel
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Practice Language / 听写语言 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={generatorLanguage}
                      onChange={(e) => setGeneratorLanguage(e.target.value as "en" | "zh")}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="zh">🇨🇳 中文听写 (Chinese Practice)</option>
                      <option value="en">🇬🇧 English Spelling (英文拼写)</option>
                    </select>
                  </div>
                  
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Upload Word List File (Optional <code>.txt</code> file)
                    </label>
                    <input
                      type="file"
                      ref={textFileInputRef}
                      onChange={handleTextFileUpload}
                      accept=".txt"
                      className="hidden"
                      id="parent-txt-file-input"
                    />
                    <button
                      type="button"
                      onClick={() => textFileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold py-2 px-3 rounded-xl transition-all"
                    >
                      <Upload className="w-4 h-4 text-slate-500" />
                      Choose .txt word list
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Enter Spelling Words List / 输入听写词语列表 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={6}
                    value={generatorText}
                    onChange={(e) => setGeneratorText(e.target.value)}
                    placeholder="e.g. 收拾, 漂亮, 追上, 觉得, 突然, 干净&#10;or&#10;absorb, environment, release, temperature"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Separate words by commas, spaces, or newlines. You can also write a sentence and Gemini will extract the key spelling words!
                  </span>
                </div>

                {generationError && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 flex items-start gap-1.5">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" />
                    <span>{generationError}</span>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsGeneratingAI(false);
                      setGenerationError(null);
                    }}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isGenerating}
                    className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-slate-300 disabled:to-slate-400 text-white text-xs font-black py-2.5 px-5 rounded-xl shadow-xs transition-all"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Generating next week's practice...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Generate with Gemini
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* LIST CREATION/EDITING FORM */}
          {isCreating && (
            <form onSubmit={saveSpellingList} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  {editingListId ? "Edit Spelling List" : "Add Scanned or Custom List"}
                </h3>
                <button
                  id="parent-form-cancel"
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
                >
                  Cancel
                </button>
              </div>

              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    List Week Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={listWeek}
                    onChange={(e) => setListWeek(e.target.value)}
                    placeholder="e.g. Week 2 - Spelling 9"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Spelling Test Date (Optional)
                  </label>
                  <input
                    type="text"
                    value={listDate}
                    onChange={(e) => setListDate(e.target.value)}
                    placeholder="e.g. 7 July or Tuesday"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Language / 语言 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={listLanguage}
                    onChange={(e) => setListLanguage(e.target.value as "en" | "zh")}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="zh">🇨🇳 中文听写 (Chinese)</option>
                    <option value="en">🇬🇧 English Spelling (英文)</option>
                  </select>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Spelling Words & Sentences</span>
                  <span className="text-xs text-slate-500">{listItems.length} items total</span>
                </div>

                <div className="max-h-[350px] overflow-y-auto pr-1 space-y-3 border-t border-b border-slate-100 py-3">
                  {listItems.map((item, index) => (
                    <div key={index} className="flex gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 relative group items-start">
                      <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 mt-2 flex-shrink-0">
                        {index + 1}
                      </span>

                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="sm:col-span-1">
                          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">Word</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. absorb"
                            value={item.word}
                            onChange={(e) => handleItemChange(index, "word", e.target.value)}
                            className="w-full border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">Example Sentence</label>
                          <input
                            type="text"
                            placeholder="Mother quickly used the sponge to absorb the spilt water."
                            value={item.text}
                            onChange={(e) => handleItemChange(index, "text", e.target.value)}
                            className="w-full border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="text-slate-400 hover:text-red-500 self-center"
                        title="Remove word"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center justify-center gap-1.5 w-full bg-slate-50 hover:bg-slate-100 text-slate-600 py-2 border border-dashed border-slate-300 rounded-xl text-xs font-bold transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add Word Row
                </button>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  id="parent-form-cancel-footer"
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2 px-4 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  id="parent-form-save-btn"
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-5 rounded-xl shadow-xs"
                >
                  Save Spelling List
                </button>
              </div>
            </form>
          )}

          {/* LISTS DISPLAY */}
          {!isCreating && (
            <div className="space-y-3">
              <h3 className="font-bold text-slate-800 text-base">Your Active Spelling Lists</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {spellingLists.map((list) => (
                  <div key={list.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs flex flex-col justify-between hover:border-indigo-200 transition-all">
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 flex-wrap">
                            {list.week}
                            {list.isPreloaded && (
                              <span className="bg-indigo-50 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded-sm font-semibold border border-indigo-100">
                                Preloaded
                              </span>
                            )}
                            {(() => {
                              const isZh = list.language === "zh" || list.items.some(item => /[\u4e00-\u9fa5]/.test(item.word));
                              return (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-extrabold border tracking-wider ${
                                  isZh 
                                    ? "bg-red-50 text-red-700 border-red-200" 
                                    : "bg-indigo-50 text-indigo-700 border-indigo-200"
                                }`}>
                                  {isZh ? "🇨🇳 中文" : "🇬🇧 EN"}
                                </span>
                              );
                            })()}
                          </h4>
                          {list.date && (
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              Test date: {list.date}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => editExistingList(list)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-50"
                            title="Edit Spelling List"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteList(list.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-50"
                            title="Delete Spelling List"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 font-semibold mb-3">
                        Contains {list.items.length} words to test.
                      </p>

                      <div className="flex flex-wrap gap-1.5 max-h-[76px] overflow-hidden mb-3">
                        {list.items.map((item) => (
                          <span
                            key={item.id}
                            className="bg-slate-50 border border-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full font-mono"
                          >
                            {item.word}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => setPreviewListId(previewListId === list.id ? null : list.id)}
                      className="w-full flex items-center justify-center gap-1 text-xs font-bold py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {previewListId === list.id ? "Hide sentences" : "Show full sentences"}
                    </button>

                    {previewListId === list.id && (
                      <div className="mt-3 pt-3 border-t border-slate-100 text-xs space-y-1.5 bg-slate-50/50 p-2.5 rounded-lg max-h-[200px] overflow-y-auto">
                        {list.items.map((item) => (
                          <div key={item.id} className="flex gap-1.5 text-slate-700 leading-relaxed">
                            <span className="font-bold text-indigo-600">{item.id}.</span>
                            <span>
                              <strong className="underline decoration-indigo-400 font-sans">{item.word}</strong>: "{item.text}"
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {spellingLists.length === 0 && (
                  <div className="col-span-full py-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                    <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-600">No spelling lists found</p>
                    <p className="text-xs text-slate-400">Click manual add or upload a photo to get started.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TEST HISTORY */}
      {activeTab === "history" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-base">Graded Scorecards ({testAttempts.length})</h3>
            {testAttempts.length > 0 && (
              <button
                id="parent-clear-history-btn"
                onClick={() => {
                  if (confirm("Are you sure you want to clear all scorecard history? This cannot be undone.")) {
                    clearHistory();
                  }
                }}
                className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All History
              </button>
            )}
          </div>

          <div className="space-y-4">
            {testAttempts.map((attempt) => (
              <div key={attempt.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs hover:border-slate-300 transition-all">
                {/* Scorecard Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wide">
                      {attempt.date}
                    </span>
                    <h4 className="font-bold text-slate-800 text-sm">
                      {attempt.listTitle}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Practice Mode:{" "}
                      <span className="font-semibold text-indigo-600 capitalize">
                        {attempt.mode === "spelling" ? "Spelling Practice" : "Vocabulary Quiz"}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className="text-lg font-black text-slate-800 block">
                        {attempt.score} / {attempt.total}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Score ({Math.round((attempt.score / attempt.total) * 100)}%)
                      </span>
                    </div>

                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                      attempt.score === attempt.total
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                        : attempt.score >= attempt.total * 0.7
                        ? "bg-amber-50 text-amber-600 border border-amber-200"
                        : "bg-red-50 text-red-600 border border-red-200"
                    }`}>
                      {attempt.score === attempt.total ? "🌟" : `${Math.round((attempt.score / attempt.total) * 100)}%`}
                    </div>
                  </div>
                </div>

                {/* Scorecard Details (Collapsible review) */}
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-700">Detailed Review:</p>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {attempt.results.map((res, index) => {
                      return (
                        <div key={index} className="p-3 bg-slate-50 rounded-xl border border-slate-150 text-xs">
                          <div className="flex items-start justify-between mb-1">
                            <span className="font-semibold text-slate-700">Item {res.itemId}: "{res.word}"</span>
                            <div className="flex items-center gap-1.5">
                              {res.hintUsed && (
                                <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded-sm">
                                  Hint Used
                                </span>
                              )}
                              {res.isCorrect ? (
                                <span className="text-emerald-600 font-bold flex items-center gap-1 text-[11px]">
                                  <CheckCircle className="w-3.5 h-3.5" /> Correct
                                </span>
                              ) : (
                                <span className="text-red-500 font-bold flex items-center gap-1 text-[11px]">
                                  <XCircle className="w-3.5 h-3.5" /> Incorrect
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p className="text-slate-500 italic">"{res.text}"</p>
                            <div className="grid grid-cols-2 gap-2 mt-1.5 pt-1.5 border-t border-slate-100">
                              <div>
                                <span className="text-[10px] text-slate-400 block font-bold uppercase">He Answered</span>
                                <span className={`font-mono text-xs font-semibold ${res.isCorrect ? "text-emerald-700" : "text-red-600 underline decoration-dashed"}`}>
                                  {res.typed || "(Empty)"}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block font-bold uppercase">Correct Word</span>
                                <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-200/50 px-1.5 py-0.5 rounded-sm">
                                  {res.word}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}

            {testAttempts.length === 0 && (
              <div className="py-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">No scorecards found</p>
                <p className="text-xs text-slate-400">Your son's graded mock spelling tests will show up here.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ANALYTICS & INSIGHTS */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* Key Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-3xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl font-bold border border-amber-100">
                <Award className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wide">Stars Earned</span>
                <span className="text-xl font-black text-slate-800">{totalStars} ✨</span>
              </div>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-3xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl font-bold border border-indigo-100">
                <BookOpen className="w-6 h-6 text-indigo-500" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wide">Mock Tests Taken</span>
                <span className="text-xl font-black text-slate-800">{totalTests} tests</span>
              </div>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-3xs flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold border ${
                avgScore >= 80 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
              }`}>
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wide">Average Score</span>
                <span className="text-xl font-black text-slate-800">{avgScore}%</span>
              </div>
            </div>
          </div>

          {/* Insights content */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Problem Words / Hard Words */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs space-y-4">
              <div>
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <AlertCircle className="text-amber-500 w-4 h-4" />
                  Struggled Words Checklist
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  These spelling words were missed multiple times. Use these to review together!
                </p>
              </div>

              <div className="space-y-3">
                {problemWords.map(([word, details], index) => (
                  <div key={index} className="p-3 bg-red-50/50 rounded-xl border border-red-100/70 flex justify-between items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-red-700 bg-red-100 px-2 py-0.5 rounded-md">
                          {word}
                        </span>
                        <span className="text-[10px] text-slate-400">from {details.listTitle}</span>
                      </div>
                      <p className="text-xs text-slate-600 italic mt-1.5 leading-relaxed">
                        "{details.sentence}"
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="text-xs font-extrabold text-red-600 bg-white border border-red-200 px-2 py-1 rounded-full shadow-3xs block">
                        Missed {details.count}x
                      </span>
                    </div>
                  </div>
                ))}

                {problemWords.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm font-semibold">No problem words recorded yet!</p>
                    <p className="text-xs">Your son is acing his tests. Fantastic!</p>
                  </div>
                )}
              </div>
            </div>

            {/* Supportive Parent Tips */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs space-y-4">
              <div>
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <Award className="text-indigo-500 w-4 h-4" />
                  Weekly Spelling Action Plan
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Proven routines to help {childName || "your son"} prepare effectively on his own.
                </p>
              </div>

              <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed">
                <div className="flex gap-2.5 items-start">
                  <div className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 font-bold flex items-center justify-center flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-800 mb-0.5">First 2 Days: Practice Mode (Word Focus)</h5>
                    <p>Let him do "Word Practice" first. In this mode, the app reads the word out loud, and shows letter count boxes as helpful hints. It encourages him to link sound to spellings.</p>
                  </div>
                </div>

                <div className="flex gap-2.5 items-start">
                  <div className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 font-bold flex items-center justify-center flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-800 mb-0.5">Days 3-4: Sentence Dictation Focus</h5>
                    <p>Tested spelling is often embedded in full sentences to check comprehension. Have him do "Sentence Dictation" to practice capitalization, spaces, punctuation, and the spelling words together.</p>
                  </div>
                </div>

                <div className="flex gap-2.5 items-start">
                  <div className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 font-bold flex items-center justify-center flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-800 mb-0.5">Day 5 (Before Test): Full Mock Test</h5>
                    <p>Do a simulated "Mock Test" without any visual cues or hints. This mimics the real Tuesday spelling test condition perfectly, helping him build confidence on his own!</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: WRONG WORD NOTEBOOK / 错题本 */}
      {activeTab === "notebook" && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="text-left">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <span>🚨</span>
                {childName} 的错题本 (Spelling Mistake Notebook)
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Here are the spelling words {childName} got wrong on the highest difficulty ("Pro Grand Prix" level). He can redo them anytime directly in the spelling track!
              </p>
            </div>
            {wrongWords.length > 0 && (
              <button
                type="button"
                onClick={onClearWrongWords}
                className="self-start sm:self-center flex items-center gap-1.5 text-xs font-black text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-100 px-3.5 py-1.5 rounded-xl transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                清空错题本 (Clear All)
              </button>
            )}
          </div>

          {wrongWords.length === 0 ? (
            <div className="text-center py-16 space-y-3 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <span className="text-5xl block animate-bounce">🏆</span>
              <h4 className="font-extrabold text-slate-800 text-sm">错题本空空如也！{childName} 棒棒哒！</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No mistakes registered yet! {childName} hasn't missed any spelling words on Advanced difficulty, or he has successfully cleared them all! Keep it up!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-xs text-amber-800 font-bold text-left">
                🏎️ <strong>练习提示：</strong>{childName} 可以在听写主页面的第一个列表选择 <strong>"🚨 我的错题本 (Wrong Word Notebook)"</strong> 进行挑战。每当他拼对一个词，该词就会自动清除出本哦！
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {wrongWords.map((item, index) => (
                  <div
                    key={index}
                    className="p-4 bg-white border border-slate-200 rounded-2xl shadow-3xs flex justify-between items-start group hover:border-slate-350 transition-all"
                  >
                    <div className="space-y-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400 font-bold">#{index + 1}</span>
                        <strong className="text-lg font-black text-slate-800 font-sans tracking-wide">
                          {item.word}
                        </strong>
                      </div>
                      <p className="text-xs text-slate-500 italic leading-relaxed">
                        "{item.text}"
                      </p>
                      {item.definition && (
                        <p className="text-[11px] text-indigo-600 font-semibold mt-1">
                          📖 {item.definition}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoveWrongWord(item.word)}
                      className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-100 transition-all"
                      title="Remove word from notebook"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
