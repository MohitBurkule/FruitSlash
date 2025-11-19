import React, { useEffect, useRef } from 'react';
import { GameState, FruitType, Entity, Particle, TrailPoint, FloatingText } from '../types';
import { GRAVITY, BLADE_LIFETIME, BLADE_WIDTH, BLADE_COLOR, BLADE_GLOW, FRUIT_CONFIG, MAX_LIVES, SPAWN_RATE_INITIAL, DIFFICULTY_RAMP, SPAWN_RATE_MIN, SLICE_MIN_VELOCITY } from '../constants';
import { soundManager } from '../utils/sound';
import { gameStore } from '../store';

interface GameEngineProps {
  gameState: GameState;
  onScoreUpdate: (score: number) => void;
  onLivesUpdate: (lives: number) => void;
  onGameOver: () => void;
  setGameRef: (ref: any) => void;
}

// Math Helper: Squared distance from point p to line segment vw
function distToSegmentSquared(p: { x: number, y: number }, v: { x: number, y: number }, w: { x: number, y: number }) {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return (p.x - v.x) ** 2 + (p.y - v.y) ** 2;
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return (p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2;
}

export const GameEngine: React.FC<GameEngineProps> = ({
  gameState,
  onScoreUpdate,
  onLivesUpdate,
  onGameOver,
  setGameRef
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Refs for mutable game state to avoid react re-renders in game loop
  const stateRef = useRef({
    score: 0,
    lives: MAX_LIVES,
    fruits: [] as Entity[],
    particles: [] as Particle[],
    floatingTexts: [] as FloatingText[],
    trail: [] as TrailPoint[],
    lastSpawnTime: 0,
    difficulty: 1,
    width: 0,
    height: 0,
    mouseX: 0,
    mouseY: 0,
    mouseVx: 0,
    mouseVy: 0,
    lastInputTime: 0,
    isMouseDown: false,
    mouseSpeed: 0,
    comboCount: 0,
    comboTimer: 0,
    frameCount: 0,
    startTime: performance.now()
  });

  // Initialize/Reset Logic exposed to parent
  useEffect(() => {
    setGameRef({
      reset: () => {
        stateRef.current = {
          ...stateRef.current,
          score: 0,
          lives: MAX_LIVES,
          fruits: [],
          particles: [],
          floatingTexts: [],
          trail: [],
          difficulty: 1,
          comboCount: 0,
          frameCount: 0,
          startTime: performance.now(),
          isMouseDown: false
        };
        onScoreUpdate(0);
        onLivesUpdate(MAX_LIVES);
        soundManager.playGameStart();
      }
    });
  }, [setGameRef, onScoreUpdate, onLivesUpdate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Handle Resize
    const handleResize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        stateRef.current.width = canvas.width;
        stateRef.current.height = canvas.height;

        // Immediate initial draw to prevent black flicker
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    // --- INPUT HANDLING ---

    const checkForSlice = (x1: number, y1: number, x2: number, y2: number, force: boolean = false) => {
      const { fruits, mouseSpeed } = stateRef.current;

      // If it's a forced click, we ignore speed. 
      // If it's a drag/swipe, we use a lower threshold (2) to allow "slower" controlled cuts.
      if (!force && mouseSpeed < 2) return;

      for (let i = fruits.length - 1; i >= 0; i--) {
        const f = fruits[i];
        if (f.isSliced) continue;

        // Check collision with the line segment of the blade movement
        const distSq = distToSegmentSquared(
          { x: f.x, y: f.y },
          { x: x1, y: y1 },
          { x: x2, y: y2 }
        );

        // If "force" (click) is true, use a larger hitbox (radius + 20px) to be forgiving
        // Otherwise use standard radius
        const hitRadius = force ? (f.radius + 20) : f.radius;

        if (distSq < hitRadius * hitRadius) {
          sliceFruit(f, i);
        }
      }
    };

    const updateInputPosition = (x: number, y: number) => {
      const now = performance.now();
      const dt = now - stateRef.current.lastInputTime;

      // Prevent division by zero or extremely small dt
      if (dt < 1) return;

      const prevX = stateRef.current.mouseX;
      const prevY = stateRef.current.mouseY;

      const dx = x - prevX;
      const dy = y - prevY;

      stateRef.current.mouseVx = dx;
      stateRef.current.mouseVy = dy;

      // Normalize speed to pixels per ~16ms (60fps frame)
      // This ensures consistent speed values regardless of polling rate
      const rawSpeed = Math.sqrt(dx * dx + dy * dy);
      stateRef.current.mouseSpeed = (rawSpeed / dt) * 16.66;

      stateRef.current.mouseX = x;
      stateRef.current.mouseY = y;
      stateRef.current.lastInputTime = now;

      // If mouse is held down, we check for slices along the path
      if (stateRef.current.isMouseDown) {
        checkForSlice(prevX, prevY, x, y, false);
      }
    };

    // Pointer Handlers (Unifies Mouse and Touch)
    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      canvas.setPointerCapture(e.pointerId);

      stateRef.current.isMouseDown = true;
      stateRef.current.mouseX = x;
      stateRef.current.mouseY = y;
      stateRef.current.mouseSpeed = 0;
      stateRef.current.lastInputTime = performance.now(); // Reset time
      stateRef.current.trail = [];
      // Add initial point to trail for visual feedback on tap
      stateRef.current.trail.push({ x, y, age: BLADE_LIFETIME });

      soundManager.init();
      checkForSlice(x, y, x, y, true); // Force slice at point

      // Add a small visual spark at click location
      for (let i = 0; i < 5; i++) {
        stateRef.current.particles.push({
          id: Math.random().toString(),
          x, y,
          vx: (Math.random() - 0.5) * 15,
          vy: (Math.random() - 0.5) * 15,
          life: 0.2,
          decay: 0.05,
          color: '#FFF',
          size: 2,
          type: 'SPARK'
        });
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      e.preventDefault();
      if (!stateRef.current.isMouseDown) return;

      const rect = canvas.getBoundingClientRect();
      updateInputPosition(e.clientX - rect.left, e.clientY - rect.top);
    };

    const onPointerUp = (e: PointerEvent) => {
      e.preventDefault();
      stateRef.current.isMouseDown = false;
      stateRef.current.trail = [];
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);

    // --- GAME LOGIC ---

    const spawnFruit = () => {
      const { width, height, difficulty } = stateRef.current;
      const types = Object.keys(FRUIT_CONFIG) as FruitType[];

      const isBomb = Math.random() < Math.min(0.05 + (difficulty * 0.02), 0.25);
      const type = isBomb ? FruitType.BOMB : types[Math.floor(Math.random() * (types.length - 1))];

      const radius = FRUIT_CONFIG[type].radius;
      const x = Math.random() * (width - 100) + 50;
      const y = height + radius;

      const vx = (width / 2 - x) * (0.01 + Math.random() * 0.01);
      const vy = -(Math.random() * 5 + 12 + difficulty);

      stateRef.current.fruits.push({
        id: Math.random().toString(36).substr(2, 9),
        x,
        y,
        vx,
        vy,
        rotation: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.2,
        scale: 1,
        color: FRUIT_CONFIG[type].color,
        type,
        isSliced: false,
        isDead: false,
        radius
      });
    };

    const createExplosion = (x: number, y: number, juiceColor: string, skinColor: string, type: 'FRUIT' | 'BOMB') => {
      const particleCount = type === 'BOMB' ? 60 : 40;
      const speedMulti = type === 'BOMB' ? 3 : 1.5;

      for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (Math.random() * 8 + 2) * speedMulti;

        // 50% Drop (Circle), 50% Chunk (Poly)
        const isChunk = Math.random() > 0.5;
        const pType = isChunk ? 'CHUNK' : 'DROPLET';

        // Determine color based on type
        let color = juiceColor;
        if (isChunk) {
          // Chunks can be skin color or flesh color
          color = Math.random() > 0.4 ? skinColor : juiceColor;
        }

        if (type === 'BOMB') {
          // Bomb particles are fire/smoke
          const rnd = Math.random();
          if (rnd > 0.7) color = '#FFFF00'; // Spark
          else if (rnd > 0.3) color = '#FF4500'; // Fire
          else color = '#555555'; // Smoke
        }

        stateRef.current.particles.push({
          id: Math.random().toString(),
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: Math.random() * 0.5 + 0.5,
          decay: Math.random() * 0.03 + 0.01,
          color: color,
          size: Math.random() * (isChunk ? 8 : 5) + 2,
          type: pType,
          rotation: Math.random() * Math.PI * 2,
          vRotation: (Math.random() - 0.5) * 0.4
        });
      }

      // Add a few "Sparks" for style
      for (let i = 0; i < 5; i++) {
        stateRef.current.particles.push({
          id: Math.random().toString(),
          x, y,
          vx: (Math.random() - 0.5) * 10,
          vy: (Math.random() - 0.5) * 10,
          life: 0.3,
          decay: 0.05,
          color: '#FFF',
          size: 2,
          type: 'SPARK'
        });
      }
    };

    const sliceFruit = (fruit: Entity, index: number) => {
      const config = FRUIT_CONFIG[fruit.type];

      if (fruit.type === FruitType.BOMB) {
        soundManager.playBomb();
        createExplosion(fruit.x, fruit.y, '#FF4500', '#333', 'BOMB');
        // Flash white
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, stateRef.current.width, stateRef.current.height);
        gameStore.updateHighScore(stateRef.current.score);
        onGameOver();
        return;
      }

      stateRef.current.score += config.score;
      onScoreUpdate(stateRef.current.score);

      // XP Gain (1 XP per score point for now)
      gameStore.addXp(config.score);

      soundManager.playSlice();

      stateRef.current.comboCount++;
      stateRef.current.comboTimer = 15;
      if (stateRef.current.comboCount > 2) {
        stateRef.current.floatingTexts.push({
          id: Math.random().toString(),
          x: fruit.x,
          y: fruit.y - 50,
          text: `${stateRef.current.comboCount}x COMBO!`,
          life: 1.0,
          color: '#FFD700',
          size: 30
        });
        soundManager.playCombo();
      }

      createExplosion(fruit.x, fruit.y, config.juice, config.color, 'FRUIT');

      // Calculate split angle based on mouse velocity
      let angle = 0;
      if (stateRef.current.mouseSpeed > 1) {
        angle = Math.atan2(stateRef.current.mouseVy, stateRef.current.mouseVx) + Math.PI / 2;
      } else {
        // Random angle for stationary clicks
        angle = Math.random() * Math.PI * 2;
      }

      const speed = 4;
      const bladeImpact = 0.15;

      const half1: Entity = {
        ...fruit,
        id: fruit.id + '_1',
        vx: fruit.vx + Math.cos(angle) * speed + (stateRef.current.mouseVx * bladeImpact),
        vy: fruit.vy + Math.sin(angle) * speed + (stateRef.current.mouseVy * bladeImpact),
        isSliced: true,
        vr: fruit.vr - (Math.random() * 0.4 + 0.1)
      };

      const half2: Entity = {
        ...fruit,
        id: fruit.id + '_2',
        vx: fruit.vx - Math.cos(angle) * speed + (stateRef.current.mouseVx * bladeImpact),
        vy: fruit.vy - Math.sin(angle) * speed + (stateRef.current.mouseVy * bladeImpact),
        isSliced: true,
        vr: fruit.vr + (Math.random() * 0.4 + 0.1)
      };

      stateRef.current.fruits.splice(index, 1, half1, half2);
    };

    const drawFruit = (f: Entity) => {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rotation);

      const config = FRUIT_CONFIG[f.type];

      if (f.isSliced) {
        // Sliced Half
        ctx.beginPath();
        ctx.arc(0, 0, f.radius, 0, Math.PI, false);
        ctx.closePath();
        ctx.fillStyle = config.color;
        ctx.fill();
        ctx.fillStyle = '#fff'; // Rind
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, f.radius - 4, 0, Math.PI, false);
        ctx.fillStyle = config.juice;
        ctx.fill();
      } else {
        if (f.type === FruitType.BOMB) {
          ctx.beginPath();
          ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
          ctx.fillStyle = '#1a1a1a';
          ctx.fill();
          // Shine
          ctx.beginPath();
          ctx.arc(-10, -10, 8, 0, Math.PI * 2);
          ctx.fillStyle = '#333';
          ctx.fill();
          // Fuse
          ctx.beginPath();
          ctx.moveTo(0, -f.radius);
          ctx.quadraticCurveTo(10, -f.radius - 15, 20, -f.radius - 10);
          ctx.strokeStyle = '#8d6e63';
          ctx.lineWidth = 4;
          ctx.stroke();
          if (Math.random() > 0.5) {
            ctx.beginPath();
            ctx.arc(20, -f.radius - 10, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#ffeb3b';
            ctx.fill();
          }
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
          ctx.fillStyle = config.color;
          ctx.fill();

          // Simple highlights
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.beginPath();
          ctx.arc(-f.radius * 0.3, -f.radius * 0.3, f.radius * 0.2, 0, Math.PI * 2);
          ctx.fill();

          if (f.type === FruitType.WATERMELON) {
            ctx.beginPath();
            ctx.arc(0, 0, f.radius - 2, 0, Math.PI * 2);
            ctx.strokeStyle = '#27ae60';
            ctx.lineWidth = 2;
            ctx.stroke();
            for (let i = 0; i < 6; i++) {
              ctx.save();
              ctx.rotate(i * Math.PI / 3);
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(f.radius, 0);
              ctx.strokeStyle = '#1e8449';
              ctx.lineWidth = 4;
              ctx.stroke();
              ctx.restore();
            }
          }
        }
      }
      ctx.restore();
    };

    // --- MAIN LOOP ---
    let animationFrameId: number;
    const loop = () => {
      if (gameState !== GameState.PLAYING) {
        if (gameState === GameState.MENU) {
          ctx.fillStyle = '#111';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          return;
        }
      }

      const { width, height, trail, fruits, particles, floatingTexts } = stateRef.current;

      // Slow down mouse speed calculation decay to prevent instant stops
      if (performance.now() - stateRef.current.lastInputTime > 100) {
        stateRef.current.mouseSpeed *= 0.8;
      }

      // Background
      ctx.fillStyle = '#1e1e1e';
      const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width);
      gradient.addColorStop(0, '#2c3e50');
      gradient.addColorStop(1, '#000000');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // State Updates
      stateRef.current.frameCount++;

      // Difficulty Ramp
      // Slower start: 2 seconds initial gap, ramping to 0.4s minimum
      // Increase difficulty every 10 seconds instead of 5
      const timeSinceStart = (performance.now() - stateRef.current.startTime) / 1000;
      const difficultyMultiplier = Math.min(1, timeSinceStart / 120); // Reach max difficulty in 2 mins

      const spawnRateMs = 2000 - (1600 * difficultyMultiplier); // 2000ms -> 400ms
      const spawnRateFrames = Math.max(20, Math.floor(spawnRateMs / 16.66));

      if (stateRef.current.frameCount % spawnRateFrames === 0) {
        spawnFruit();
      }

      // Combo
      if (stateRef.current.comboTimer > 0) {
        stateRef.current.comboTimer--;
      } else {
        stateRef.current.comboCount = 0;
      }

      // Trail Logic
      if (stateRef.current.isMouseDown) {
        trail.push({ x: stateRef.current.mouseX, y: stateRef.current.mouseY, age: BLADE_LIFETIME });
      }
      for (let i = trail.length - 1; i >= 0; i--) {
        trail[i].age--;
        if (trail[i].age <= 0) trail.splice(i, 1);
      }

      // Draw Trail
      if (trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(trail[0].x, trail[0].y);
        for (let i = 1; i < trail.length; i++) {
          const xc = (trail[i].x + trail[i - 1].x) / 2;
          const yc = (trail[i].y + trail[i - 1].y) / 2;
          ctx.quadraticCurveTo(trail[i - 1].x, trail[i - 1].y, xc, yc);
        }
        ctx.lineTo(trail[trail.length - 1].x, trail[trail.length - 1].y);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = BLADE_WIDTH;
        ctx.strokeStyle = BLADE_COLOR;
        ctx.shadowBlur = 15;
        ctx.shadowColor = BLADE_GLOW;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Fruits
      for (let i = fruits.length - 1; i >= 0; i--) {
        const f = fruits[i];
        f.x += f.vx;
        f.y += f.vy;
        f.vy += GRAVITY;
        f.rotation += f.vr;

        if (f.y > height + 100) {
          if (!f.isSliced && f.type !== FruitType.BOMB && gameStore.settings.gameMode === 'CLASSIC') {
            stateRef.current.lives--;
            onLivesUpdate(stateRef.current.lives);
            if (stateRef.current.lives <= 0) {
              gameStore.updateHighScore(stateRef.current.score);
              onGameOver();
            }
          }
          fruits.splice(i, 1);
          continue;
        }
        drawFruit(f);
      }

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += GRAVITY * 0.5;
        p.life -= p.decay;

        if (p.rotation !== undefined && p.vRotation !== undefined) {
          p.rotation += p.vRotation;
        }

        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;

        if (p.type === 'CHUNK') {
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation || 0);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        } else if (p.type === 'SPARK') {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 2, p.y + p.vy * 2);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          // DROPLET
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Floating Text
      for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const t = floatingTexts[i];
        t.y -= 1;
        t.life -= 0.02;

        if (t.life <= 0) {
          floatingTexts.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = t.life;
        ctx.font = `bold ${t.size}px "Permanent Marker"`;
        ctx.fillStyle = t.color;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(t.text, t.x, t.y);
        ctx.fillText(t.text, t.x, t.y);
        ctx.restore();
      }

      ctx.restore();

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerUp);
    };
  }, [gameState, onGameOver, onScoreUpdate, onLivesUpdate]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full touch-none cursor-crosshair"
    />
  );
};