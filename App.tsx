import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GameEngine } from './components/GameEngine';
import { UIOverlay } from './components/UIOverlay';
import { GameState } from './types';
import { MAX_LIVES } from './constants';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('fruitSamuraiHighScore');
    return saved ? parseInt(saved, 10) : 0;
  });
  
  // Ref to access game engine methods directly
  const gameRef = useRef<{ reset: () => void } | null>(null);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('fruitSamuraiHighScore', score.toString());
    }
  }, [score, highScore]);

  const handleStart = useCallback(() => {
    setGameState(GameState.PLAYING);
    gameRef.current?.reset();
  }, []);

  const handleGameOver = useCallback(() => {
    setGameState(GameState.GAME_OVER);
  }, []);

  return (
    <div className="w-full h-screen relative bg-neutral-900 overflow-hidden select-none">
      <GameEngine 
        gameState={gameState}
        onScoreUpdate={setScore}
        onLivesUpdate={setLives}
        onGameOver={handleGameOver}
        setGameRef={(ref) => gameRef.current = ref}
      />
      <UIOverlay 
        gameState={gameState}
        score={score}
        highScore={highScore}
        lives={lives}
        onStart={handleStart}
        onRestart={handleStart}
      />
    </div>
  );
};

export default App;