export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export enum FruitType {
  APPLE = 'APPLE',
  ORANGE = 'ORANGE',
  WATERMELON = 'WATERMELON',
  BANANA = 'BANANA',
  BOMB = 'BOMB'
}

export interface Point {
  x: number;
  y: number;
}

export interface Vector {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vr: number; // rotational velocity
  scale: number;
  color: string;
  type: FruitType;
  isSliced: boolean;
  isDead: boolean; // To be removed
  radius: number;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 0 to 1
  decay: number;
  color: string;
  size: number;
  type?: 'DROPLET' | 'CHUNK' | 'SPARK';
  rotation?: number;
  vRotation?: number;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
  size: number;
}

export interface TrailPoint {
  x: number;
  y: number;
  age: number; // frames alive
}