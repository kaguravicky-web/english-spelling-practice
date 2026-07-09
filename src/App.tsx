import React, { useState, useEffect, useRef } from "react";
import DashboardHeader from "./components/DashboardHeader";
import ChildDashboard from "./components/ChildDashboard";
import ParentDashboard from "./components/ParentDashboard";
import { defaultSpellingLists, avatarList } from "./data";
import { SpellingList, TestAttempt, ParentSettings } from "./types";
import { getSpeechVoices } from "./utils";
import { Baby, Settings, Sparkles, Star, User, Volume2 } from "lucide-react";

export default function App() {
  // Mode toggle: child (default so kids can use easily) or parent
  const [mode, setMode] = useState<"child" | "parent">("child");

  // Spelling lists state, initialized from localStorage or defaults
  const [spellingLists, setSpellingLists] = useState<SpellingList[]>(() => {
    const saved = localStorage.getItem("spelling_buddy_lists");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as SpellingList[];
        // Update preloaded lists with latest contents, and keep user custom lists
        const updated = parsed.map(list => {
          if (list.isPreloaded) {
            const fresh = defaultSpellingLists.find(d => d.id === list.id);
            if (fresh) {
              return fresh;
            }
          }
          return list;
        });

        // Add any missing preloaded lists
        const updatedIds = new Set(updated.map(list => list.id));
        const missingDefaults = defaultSpellingLists.filter(list => !updatedIds.has(list.id));
        return [...updated, ...missingDefaults];
      } catch (e) {
        console.error("Error reading spelling lists from local storage:", e);
      }
    }
    return defaultSpellingLists;
  });

  // Scorecards / history state
  const [testAttempts, setTestAttempts] = useState<TestAttempt[]>(() => {
    const saved = localStorage.getItem("spelling_buddy_attempts");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error reading test attempts from local storage:", e);
      }
    }
    return [];
  });

  // Parent Settings (child's name, preferred avatar, speech rate)
  const [parentSettings, setParentSettings] = useState<ParentSettings>(() => {
    const saved = localStorage.getItem("spelling_buddy_settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure default speechRate is friendlier if not customized
        if (parsed && typeof parsed.speechRate === "number") {
          return parsed;
        }
      } catch (e) {
        console.error("Error reading settings from local storage:", e);
      }
    }
    return {
      childName: "Daniel",
      speechRate: 0.7, // Lowered default to be slow and kid-friendly
      speechVoice: ""
    };
  });

  // Chosen avatar ID
  const [avatarId, setAvatarId] = useState<string>(() => {
    return localStorage.getItem("spelling_buddy_avatar_id") || "stuart";
  });

  // Speech voices loaded from Web Speech API
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const hasAutoSelectedVoice = useRef(false);

  // Effect to load speech voices and auto-select male voice if not set
  useEffect(() => {
    const loadVoices = () => {
      const available = getSpeechVoices();
      setVoices(available);

      if (!hasAutoSelectedVoice.current && available.length > 0) {
        const saved = localStorage.getItem("spelling_buddy_settings");
        let savedVoice = "";
        if (saved) {
          try {
            savedVoice = JSON.parse(saved).speechVoice || "";
          } catch (e) {}
        }

        // If no preferred voice is set, find a warm jolly male voice to be default
        if (!savedVoice) {
          const englishVoices = available.filter(v => v.lang.toLowerCase().includes("en"));
          const maleKeywords = ["david", "mark", "george", "daniel", "alex", "fred", "male", "james", "murtaza", "ian", "ravi"];
          const foundMale = englishVoices.find(v => 
            maleKeywords.some(k => v.name.toLowerCase().includes(k))
          );
          if (foundMale) {
            setParentSettings(prev => ({ ...prev, speechVoice: foundMale.name }));
          }
        }
        hasAutoSelectedVoice.current = true;
      }
    };

    loadVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Save spelling lists to localStorage
  useEffect(() => {
    localStorage.setItem("spelling_buddy_lists", JSON.stringify(spellingLists));
  }, [spellingLists]);

  // Save attempts to localStorage
  useEffect(() => {
    localStorage.setItem("spelling_buddy_attempts", JSON.stringify(testAttempts));
  }, [testAttempts]);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem("spelling_buddy_settings", JSON.stringify(parentSettings));
  }, [parentSettings]);

  // Save avatar to localStorage
  useEffect(() => {
    localStorage.setItem("spelling_buddy_avatar_id", avatarId);
  }, [avatarId]);

  // Score recording handler
  const handleCompleteTest = (attempt: TestAttempt) => {
    setTestAttempts(prev => [attempt, ...prev]);
  };

  // Clear score history
  const clearHistory = () => {
    setTestAttempts([]);
  };

  // Find active avatar properties
  const currentAvatar = avatarList.find(a => a.id === avatarId) || avatarList[0];
  const totalStars = testAttempts.reduce((sum, item) => sum + item.score, 0);

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans" id="app-wrapper-div">
      {/* Dashboard Header containing controls */}
      <DashboardHeader
        mode={mode}
        setMode={setMode}
        childName={parentSettings.childName}
        avatarEmoji={currentAvatar.emoji}
        totalStars={totalStars}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6" id="main-content-layout">
        {mode === "child" ? (
          /* CHILD INTERACTION MODE */
          <div className="space-y-6">
            <ChildDashboard
              spellingLists={spellingLists}
              onCompleteTest={handleCompleteTest}
              settings={parentSettings}
              avatarEmoji={currentAvatar.emoji}
              onUpdateSettings={setParentSettings}
            />
          </div>
        ) : (
          /* PARENT SETTINGS & PROGRESS TRACKER */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Parent Customizer Side Widget */}
            <div className="lg:col-span-1 space-y-6 bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <User className="w-4 h-4 text-indigo-500" />
                  Child Learner Profile
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure learning preferences, spelling voice speed, and name.
                </p>
              </div>

              {/* Form details */}
              <div className="space-y-4">
                {/* Child Name Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Your Child's Name
                  </label>
                  <input
                    id="profile-child-name-input"
                    type="text"
                    value={parentSettings.childName}
                    onChange={(e) => setParentSettings(prev => ({ ...prev, childName: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. Daniel"
                  />
                </div>

                {/* Avatar Chooser */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Select Avatar Buddy
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {avatarList.map((avatar) => (
                      <button
                        key={avatar.id}
                        onClick={() => setAvatarId(avatar.id)}
                        className={`p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all ${
                          avatarId === avatar.id
                            ? "bg-indigo-50 border-indigo-500 shadow-3xs"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                        title={avatar.name}
                      >
                        <span className="text-2xl leading-none">{avatar.emoji}</span>
                        <span className="text-[9px] font-bold text-slate-500 mt-1 truncate max-w-full text-center">
                          {avatar.name.split(" ")[0]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Speech Dictation Settings */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-1">
                    <Volume2 className="w-3.5 h-3.5 text-slate-500" />
                    Speech Dictation Rate ({parentSettings.speechRate}x)
                  </label>
                  <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
                    Adjusted default to <strong>0.7x (Slow & Warm)</strong> based on student feedback. Try 0.6x or 0.65x if it still feels too fast!
                  </p>
                  <input
                    id="profile-speech-rate-range"
                    type="range"
                    min="0.5"
                    max="1.2"
                    step="0.05"
                    value={parentSettings.speechRate}
                    onChange={(e) => setParentSettings(prev => ({ ...prev, speechRate: parseFloat(e.target.value) }))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-1">
                    <span>Very Slow (0.5x)</span>
                    <span>Normal (1.0x)</span>
                  </div>
                </div>

                {/* Speech Voice Selection */}
                {voices.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Preferred Voice Accent
                    </label>
                    <select
                      id="profile-speech-voice-select"
                      value={parentSettings.speechVoice}
                      onChange={(e) => setParentSettings(prev => ({ ...prev, speechVoice: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl px-2 py-1.5 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="">Default Browser Voice</option>
                      {voices
                        .filter(v => v.lang.toLowerCase().includes("en")) // English voice filters
                        .map((voice) => {
                          const nameLower = voice.name.toLowerCase();
                          const isMale = ["david", "mark", "george", "daniel", "alex", "fred", "male", "james", "murtaza", "ian", "ravi"].some(k => nameLower.includes(k));
                          return (
                            <option key={voice.name} value={voice.name}>
                              {isMale ? "👨 [Jolly Man Profile] " : "🤖 "} {voice.name} ({voice.lang})
                            </option>
                          );
                        })}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                      💡 <strong>Hint for {parentSettings.childName}:</strong> Look for options labeled with <strong>👨 [Jolly Man Profile]</strong> (like Microsoft David, Alex, or Daniel) to hear a warm, friendly male voice instead of a robotic sound!
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Parent Management Portal */}
            <div className="lg:col-span-2">
              <ParentDashboard
                spellingLists={spellingLists}
                setSpellingLists={setSpellingLists}
                testAttempts={testAttempts}
                clearHistory={clearHistory}
                childName={parentSettings.childName}
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer bar */}
      <footer className="bg-white border-t border-slate-100 py-6 text-center text-xs text-slate-400">
        <p>© 2026 Spelling Prep Buddy. Powered by Gemini Flash AI.</p>
        <p className="mt-1">Designed with love to support weekly dictation test prep on his own.</p>
      </footer>
    </div>
  );
}
