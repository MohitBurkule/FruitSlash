import React, { useState } from 'react';
import { GameState } from '../types';
import { Play, RotateCcw, Skull, Trophy, Settings, Volume2, VolumeX, Zap } from 'lucide-react';
import { useGameStore } from '../store';

interface UIOverlayProps {
  gameState: GameState;
  score: number;
  highScore: number;
  lives: number;
  onStart: () => void;
  onRestart: () => void;
}

export const UIOverlay: React.FC<UIOverlayProps> = ({
  gameState,
  score,
  highScore,
  lives,
  onStart,
  onRestart
}) => {
  const { progress, settings, updateSettings } = useGameStore();
  const [showSettings, setShowSettings] = useState(false);

  // Calculate XP progress for current level
  // Level N requires N^2 * 100 XP total? Or just simple 100 * N^2?
  // Store logic was: Level = sqrt(XP / 100) + 1
  // So XP for Level L = (L-1)^2 * 100
  const currentLevelBaseXp = Math.pow(progress.level - 1, 2) * 100;
  const nextLevelBaseXp = Math.pow(progress.level, 2) * 100;
  const xpInLevel = progress.totalXp - currentLevelBaseXp;
  const xpRequired = nextLevelBaseXp - currentLevelBaseXp;
  const xpPercent = Math.min(100, Math.max(0, (xpInLevel / xpRequired) * 100));

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-col justify-between p-4 sm:p-8 z-10">

      {/* HUD */}
      <div className="flex justify-between items-start w-full">
        <div className="flex flex-col gap-2">
          <div className="text-4xl sm:text-6xl font-bold text-yellow-400 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] arcade-font animate-pulse">
            {score}
          </div>
          <div className="text-sm sm:text-base text-yellow-200 opacity-80 arcade-font">
            BEST: {Math.max(highScore, progress.highScore)}
          </div>

          {/* Level / XP Bar */}
          <div className="flex flex-col gap-1 mt-2">
            <div className="flex items-center gap-2">
              <div className="bg-yellow-600 text-white text-xs font-bold px-2 py-0.5 rounded border border-yellow-400">
                LVL {progress.level}
              </div>
              <div className="text-xs text-yellow-200/80 font-mono">
                {Math.floor(xpInLevel)} / {xpRequired} XP
              </div>
            </div>
            <div className="w-32 h-2 bg-black/50 rounded-full overflow-hidden border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 to-red-500 transition-all duration-500"
                style={{ width: `${xpPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-4">
          {/* Lives */}
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className={`transition-opacity duration-300 ${i < lives ? 'opacity-100' : 'opacity-20 grayscale'}`}
              >
                <span className="text-3xl sm:text-4xl">❌</span>
              </div>
            ))}
          </div>

          {/* Settings Button */}
          <button
            onClick={() => setShowSettings(true)}
            className="pointer-events-auto p-2 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-sm transition-all hover:rotate-90"
          >
            <Settings className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* MENUS */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">

        {/* Settings Modal */}
        {showSettings && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 pointer-events-auto animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-neutral-900 p-8 rounded-3xl border-2 border-white/20 w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold text-white arcade-font">SETTINGS</h2>
                <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white">
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                {/* Music Volume */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-300">
                    <span className="flex items-center gap-2"><Volume2 className="w-4 h-4" /> Music</span>
                    <span>{Math.round(settings.musicVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0" max="1" step="0.1"
                    value={settings.musicVolume}
                    onChange={(e) => updateSettings({ musicVolume: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                  />
                </div>

                {/* SFX Volume */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-300">
                    <span className="flex items-center gap-2"><Zap className="w-4 h-4" /> SFX</span>
                    <span>{Math.round(settings.sfxVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0" max="1" step="0.1"
                    value={settings.sfxVolume}
                    onChange={(e) => updateSettings({ sfxVolume: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                  />
                </div>

                {/* Game Mode */}
                <div className="space-y-2 pt-4 border-t border-white/10">
                  <div className="text-sm text-gray-300 mb-2">Game Mode</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateSettings({ gameMode: 'CLASSIC' })}
                      className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${settings.gameMode === 'CLASSIC' ? 'bg-red-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                    >
                      CLASSIC
                    </button>
                    <button
                      onClick={() => updateSettings({ gameMode: 'ZEN' })}
                      className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${settings.gameMode === 'ZEN' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                    >
                      ZEN
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {settings.gameMode === 'CLASSIC' ? 'Missed fruits lose lives. Bombs kill.' : 'Relaxed. Only bombs end the game.'}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowSettings(false)}
                className="w-full mt-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition-colors"
              >
                CLOSE
              </button>
            </div>
          </div>
        )}

        {gameState === GameState.MENU && !showSettings && (
          <div className="bg-black/80 backdrop-blur-sm p-8 rounded-3xl border-4 border-yellow-500 text-center shadow-[0_0_50px_rgba(234,179,8,0.3)] transform transition-all hover:scale-105 pointer-events-auto">
            <h1 className="text-6xl sm:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-red-500 mb-4 arcade-font drop-shadow-md">
              FRUIT<br />SAMURAI
            </h1>
            <p className="text-gray-300 mb-8 text-lg animate-bounce">Swipe to slice. Avoid bombs.</p>
            <button
              onClick={onStart}
              className="group relative px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-bold text-xl rounded-full transition-all shadow-[0_4px_0_rgb(153,27,27)] hover:shadow-[0_2px_0_rgb(153,27,27)] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px]"
            >
              <div className="flex items-center gap-2">
                <Play className="w-6 h-6 fill-current" />
                <span>DOJO START</span>
              </div>
            </button>
          </div>
        )}

        {gameState === GameState.GAME_OVER && !showSettings && (
          <div className="bg-black/90 p-8 rounded-3xl border-4 border-red-600 text-center max-w-md w-full animate-[fadeIn_0.3s_ease-out] pointer-events-auto">
            <Skull className="w-16 h-16 mx-auto text-red-500 mb-4 animate-pulse" />
            <h2 className="text-5xl font-bold text-red-500 mb-2 arcade-font">GAME OVER</h2>

            <div className="flex flex-col gap-2 my-6">
              <div className="flex justify-between items-center bg-white/10 p-3 rounded-lg">
                <span className="text-gray-400">Score</span>
                <span className="text-2xl font-bold text-yellow-400">{score}</span>
              </div>
              <div className="flex justify-between items-center bg-white/10 p-3 rounded-lg">
                <span className="text-gray-400">Best</span>
                <span className="text-2xl font-bold text-green-400">{Math.max(highScore, progress.highScore)}</span>
              </div>

              {/* XP Gained */}
              <div className="flex justify-between items-center bg-yellow-500/20 p-3 rounded-lg border border-yellow-500/30">
                <span className="text-yellow-200">XP Gained</span>
                <span className="text-xl font-bold text-yellow-400">+{score} XP</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onRestart}
                className="flex-1 px-4 py-4 bg-green-600 hover:bg-green-500 text-white font-bold text-xl rounded-xl transition-all shadow-[0_4px_0_rgb(21,128,61)] hover:shadow-[0_2px_0_rgb(21,128,61)] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px]"
              >
                <div className="flex items-center justify-center gap-2">
                  <RotateCcw className="w-6 h-6" />
                  <span>AGAIN</span>
                </div>
              </button>
              <button
                onClick={() => {
                  const text = `I scored ${score} in Fruit Samurai! Can you beat me?`;
                  if (navigator.share) {
                    navigator.share({ title: 'Fruit Samurai', text, url: window.location.href });
                  } else {
                    navigator.clipboard.writeText(text);
                    alert('Score copied to clipboard!');
                  }
                }}
                className="px-4 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xl rounded-xl transition-all shadow-[0_4px_0_rgb(37,99,235)] hover:shadow-[0_2px_0_rgb(37,99,235)] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px]"
              >
                <Trophy className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer / Credits */}
      {gameState === GameState.MENU && (
        <div className="absolute bottom-4 w-full text-center text-gray-500 text-xs">
          Made with React & Canvas
        </div>
      )}

    </div>
  );
};