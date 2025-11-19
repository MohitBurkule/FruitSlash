import React from 'react';
import { GameState } from '../types';
import { Play, RotateCcw, Skull, Trophy } from 'lucide-react';

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
  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-col justify-between p-4 sm:p-8 z-10">
      
      {/* HUD */}
      <div className="flex justify-between items-start w-full">
        <div className="flex flex-col gap-2">
          <div className="text-4xl sm:text-6xl font-bold text-yellow-400 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] arcade-font animate-pulse">
            {score}
          </div>
          <div className="text-sm sm:text-base text-yellow-200 opacity-80 arcade-font">
             BEST: {highScore}
          </div>
        </div>

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
      </div>

      {/* MENUS */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
        
        {gameState === GameState.MENU && (
          <div className="bg-black/80 backdrop-blur-sm p-8 rounded-3xl border-4 border-yellow-500 text-center shadow-[0_0_50px_rgba(234,179,8,0.3)] transform transition-all hover:scale-105">
             <h1 className="text-6xl sm:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-red-500 mb-4 arcade-font drop-shadow-md">
               FRUIT<br/>SAMURAI
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

        {gameState === GameState.GAME_OVER && (
          <div className="bg-black/90 p-8 rounded-3xl border-4 border-red-600 text-center max-w-md w-full animate-[fadeIn_0.3s_ease-out]">
             <Skull className="w-16 h-16 mx-auto text-red-500 mb-4 animate-pulse" />
             <h2 className="text-5xl font-bold text-red-500 mb-2 arcade-font">GAME OVER</h2>
             
             <div className="flex flex-col gap-2 my-6">
               <div className="flex justify-between items-center bg-white/10 p-3 rounded-lg">
                  <span className="text-gray-400">Score</span>
                  <span className="text-2xl font-bold text-yellow-400">{score}</span>
               </div>
               <div className="flex justify-between items-center bg-white/10 p-3 rounded-lg">
                  <span className="text-gray-400">Best</span>
                  <span className="text-2xl font-bold text-green-400">{highScore}</span>
               </div>
             </div>

             <button 
                onClick={onRestart}
                className="w-full px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-bold text-xl rounded-xl transition-all shadow-[0_4px_0_rgb(21,128,61)] hover:shadow-[0_2px_0_rgb(21,128,61)] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px]"
             >
                <div className="flex items-center justify-center gap-2">
                   <RotateCcw className="w-6 h-6" />
                   <span>TRY AGAIN</span>
                </div>
             </button>
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