import React from "react";
import { Sparkles, Settings, Baby, Trophy, Star } from "lucide-react";

interface DashboardHeaderProps {
  mode: "child" | "parent";
  setMode: (mode: "child" | "parent") => void;
  childName: string;
  avatarEmoji: string;
  totalStars: number;
}

export default function DashboardHeader({
  mode,
  setMode,
  childName,
  avatarEmoji,
  totalStars
}: DashboardHeaderProps) {
  return (
    <header className="bg-white border-b border-slate-100 sticky top-0 z-10 shadow-xs px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between py-3 gap-4">
        {/* Logo and Greeting */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-red-600 via-amber-500 to-yellow-400 flex items-center justify-center text-xl shadow-md border border-slate-900/10">
            🏎️
          </div>
          <div>
            <h1 className="text-xl font-black font-sans text-slate-800 tracking-tight flex items-center gap-1.5 uppercase">
              F1 Spelling Grand Prix
            </h1>
            <p className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <span>Interactive dictation and spelling practice</span>
            </p>
          </div>
        </div>

        {/* Child Profile Widget & Star Meter */}
        <div className="flex items-center gap-4 flex-wrap justify-center">
          {mode === "child" && (
            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-full shadow-2xs">
              <span className="text-xl leading-none">{avatarEmoji}</span>
              <span className="text-sm font-semibold text-indigo-700 font-sans">
                {childName || "Super Learner"}
              </span>
              <div className="w-px h-4 bg-indigo-200 mx-1"></div>
              <div className="flex items-center gap-1 text-amber-500 font-bold text-sm">
                <Star className="w-4 h-4 fill-amber-400" id="header-star-icon" />
                <span>{totalStars}</span>
              </div>
            </div>
          )}

          {/* Mode Switch Toggle Button */}
          <div className="flex bg-slate-100 p-1 rounded-full border border-slate-200 shadow-3xs">
            <button
              id="switch-child-mode-btn"
              onClick={() => setMode("child")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
                mode === "child"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-800"
              }`}
            >
              <Baby className="w-3.5 h-3.5" />
              For {childName || "Son"}
            </button>
            <button
              id="switch-parent-mode-btn"
              onClick={() => setMode("parent")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
                mode === "parent"
                  ? "bg-slate-800 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-800"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              For Parent
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
