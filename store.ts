import { useState, useEffect } from 'react';
import { GameSettings, GameProgress } from './types';

const DEFAULT_SETTINGS: GameSettings = {
    musicVolume: 0.5,
    sfxVolume: 0.8,
    highContrast: false,
    reducedMotion: false,
    gameMode: 'ZEN'
};

const DEFAULT_PROGRESS: GameProgress = {
    totalXp: 0,
    level: 1,
    highScore: 0,
    unlockedItems: ['default_blade', 'default_bg'],
    equippedBlade: 'default_blade',
    equippedBackground: 'default_bg'
};

// Simple event bus for store updates to sync across components if needed
// For now, we'll rely on local storage and initial load, 
// but in a real app we'd use a proper store like Zustand.
// Since I can't easily add packages, I'll build a mini-store.

class GameStore {
    private listeners: (() => void)[] = [];

    settings: GameSettings;
    progress: GameProgress;

    constructor() {
        this.settings = this.loadSettings();
        this.progress = this.loadProgress();
    }

    private loadSettings(): GameSettings {
        try {
            const stored = localStorage.getItem('fruit_samurai_settings');
            return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
        } catch {
            return DEFAULT_SETTINGS;
        }
    }

    private loadProgress(): GameProgress {
        try {
            const stored = localStorage.getItem('fruit_samurai_progress');
            return stored ? { ...DEFAULT_PROGRESS, ...JSON.parse(stored) } : DEFAULT_PROGRESS;
        } catch {
            return DEFAULT_PROGRESS;
        }
    }

    save() {
        localStorage.setItem('fruit_samurai_settings', JSON.stringify(this.settings));
        localStorage.setItem('fruit_samurai_progress', JSON.stringify(this.progress));
        this.notify();
    }

    subscribe(listener: () => void) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notify() {
        this.listeners.forEach(l => l());
    }

    // Actions
    updateSettings(newSettings: Partial<GameSettings>) {
        this.settings = { ...this.settings, ...newSettings };
        this.save();
    }

    addXp(amount: number) {
        this.progress.totalXp += amount;
        // Simple level formula: Level = sqrt(XP / 100)
        const newLevel = Math.floor(Math.sqrt(this.progress.totalXp / 100)) + 1;
        if (newLevel > this.progress.level) {
            this.progress.level = newLevel;
            // Could trigger level up event here
        }
        this.save();
    }

    updateHighScore(score: number) {
        if (score > this.progress.highScore) {
            this.progress.highScore = score;
            this.save();
        }
    }
}

export const gameStore = new GameStore();

// React Hook for using the store
export function useGameStore() {
    const [state, setState] = useState({
        settings: gameStore.settings,
        progress: gameStore.progress
    });

    useEffect(() => {
        return gameStore.subscribe(() => {
            setState({
                settings: gameStore.settings,
                progress: gameStore.progress
            });
        });
    }, []);

    return {
        settings: state.settings,
        progress: state.progress,
        updateSettings: (s: Partial<GameSettings>) => gameStore.updateSettings(s),
        addXp: (amount: number) => gameStore.addXp(amount),
        updateHighScore: (score: number) => gameStore.updateHighScore(score)
    };
}
