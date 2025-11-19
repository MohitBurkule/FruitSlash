import { FruitType } from './types';

export const GRAVITY = 0.25;
export const BLADE_LIFETIME = 15; // Frames
export const BLADE_WIDTH = 8;
export const BLADE_COLOR = '#ffffff';
export const BLADE_GLOW = '#00eaff';

export const SPAWN_RATE_INITIAL = 60; // Frames between spawns
export const SPAWN_RATE_MIN = 20;
export const DIFFICULTY_RAMP = 0.05; // How much spawn rate decreases per second

export const FRUIT_CONFIG = {
  [FruitType.APPLE]: { color: '#ff4d4d', radius: 30, score: 10, juice: '#ff4d4d' },
  [FruitType.ORANGE]: { color: '#ffa500', radius: 28, score: 15, juice: '#ffa500' },
  [FruitType.WATERMELON]: { color: '#2ecc71', radius: 45, score: 25, juice: '#e74c3c' },
  [FruitType.BANANA]: { color: '#f1c40f', radius: 35, score: 20, juice: '#f1c40f' },
  [FruitType.BOMB]: { color: '#2d3436', radius: 35, score: 0, juice: '#555' }
};

export const MAX_LIVES = 3;
export const SLICE_MIN_VELOCITY = 5; // Minimum mouse speed to register a cut