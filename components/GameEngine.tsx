import React, { useEffect, useRef, useCallback } from 'react';
import { GameState, FruitType, Entity, Particle, TrailPoint, FloatingText } from '../types';
import { GRAVITY, BLADE_LIFETIME, BLADE_WIDTH, BLADE_COLOR, BLADE_GLOW, FRUIT_CONFIG, MAX_LIVES, SPAWN_RATE_INITIAL, SPAWN_RATE_MIN } from '../constants';
import { soundManager } from '../utils/sound';

interface GameEngineProps {
  gameState: GameState;
  onScoreUpdate: (score: number) => void;
  onLivesUpdate: (lives: number) => void;
  onGameOver: () => void;
  setGameRef: (ref: any) => void;
}

// Math Helper: Squared distance from point p to line segment vw
function distToSegmentSquared(p: {x:number, y:number}, v: {x:number, y:number}, w: {x:number, y:number}) {
  const l2 = (v.x - w.x)**2 + (v.y - w.y)**2;
  if (l2 === 0) return (p.x - v.x)**2 + (p.y - v.y)**2;
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return (p.x - (v.x + t * (w.x - v.x)))**2 + (p.y - (v.y + t * (w.y - v.y)))**2;
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
    comboCount: 0,
    comboTimer: 0,
    frameCount: 0
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
          isMouseDown: false
        };
        onScoreUpdate(0);
        onLivesUpdate(MAX_LIVES);
        soundManager.playGameStart();
      }
    });
  }, [setGameRef, onScoreUpdate, onLivesUpdate]);

  // --- LOGIC HELPERS ---

  const createExplosion = useCallback((x: number, y: number, juiceColor: string, skinColor: string, type: 'FRUIT' | 'BOMB') => {
    const particleCount = type === 'BOMB' ? 60 : 30;
    const speedMulti = type === 'BOMB' ? 3 : 1.2;

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 8 + 2) * speedMulti;
      
      const isChunk = Math.random() > 0.5;
      const pType = isChunk ? 'CHUNK' : 'DROPLET';
      
      let color = juiceColor;
      if (isChunk) {
           color = Math.random() > 0.4 ? skinColor : juiceColor;
      }
      
      if (type === 'BOMB') {
         const rnd = Math.random();
         if (rnd > 0.7) color = '#FFFF00'; 
         else if (rnd > 0.3) color = '#FF4500'; 
         else color = '#555555'; 
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
    
    // Spark effect
    for(let i=0; i<5; i++) {
       stateRef.current.particles.push({
          id: Math.random().toString(),
          x, y,
          vx: (Math.random()-0.5)*10,
          vy: (Math.random()-0.5)*10,
          life: 0.3,
          decay: 0.05,
          color: '#FFF',
          size: 2,
          type: 'SPARK'
       });
    }
  }, []);

  const sliceFruit = useCallback((fruit: Entity, index: number, inputVx: number, inputVy: number) => {
     const config = FRUIT_CONFIG[fruit.type];
     const ctx = canvasRef.current?.getContext('2d');
     
     if (fruit.type === FruitType.BOMB) {
       soundManager.playBomb();
       createExplosion(fruit.x, fruit.y, '#FF4500', '#333', 'BOMB');
       if (ctx) {
          ctx.fillStyle = 'white';
          ctx.fillRect(0,0, stateRef.current.width, stateRef.current.height);
       }
       onGameOver();
       return;
     }

     stateRef.current.score += config.score;
     onScoreUpdate(stateRef.current.score);
     soundManager.playSlice();

     stateRef.current.comboCount++;
     stateRef.current.comboTimer = 45; // Generous combo window
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

     // Split Physics
     // Use input velocity to direct the split, or random if static click
     let angle = Math.random() * Math.PI * 2;
     const inputSpeed = Math.sqrt(inputVx*inputVx + inputVy*inputVy);
     if (inputSpeed > 1) {
        angle = Math.atan2(inputVy, inputVx) + Math.PI/2;
     }

     const speed = 2; // Separate speed
     const bladeImpact = 0.15; // How much the swipe throws the pieces

     const half1: Entity = {
       ...fruit,
       id: fruit.id + '_1',
       vx: fruit.vx + Math.cos(angle) * speed + (inputVx * bladeImpact),
       vy: fruit.vy + Math.sin(angle) * speed + (inputVy * bladeImpact),
       isSliced: true,
       vr: fruit.vr - (Math.random() * 0.2 + 0.1)
     };
     
     const half2: Entity = {
      ...fruit,
      id: fruit.id + '_2',
      vx: fruit.vx - Math.cos(angle) * speed + (inputVx * bladeImpact),
      vy: fruit.vy - Math.sin(angle) * speed + (inputVy * bladeImpact),
      isSliced: true,
      vr: fruit.vr + (Math.random() * 0.2 + 0.1)
    };

    // Replace the original fruit with two sliced halves
    stateRef.current.fruits.splice(index, 1, half1, half2);
  }, [onScoreUpdate, onGameOver, createExplosion]);

  const checkForSlice = useCallback((x1: number, y1: number, x2: number, y2: number, force: boolean = false) => {
     const { fruits } = stateRef.current;
     
     // Iterate backwards to safely splice
     for (let i = fruits.length - 1; i >= 0; i--) {
        const f = fruits[i];
        if (f.isSliced) continue;
        
        const distSq = distToSegmentSquared(
           {x: f.x, y: f.y}, 
           {x: x1, y: y1}, 
           {x: x2, y: y2}
        );
        
        // Hitbox: Radius + Buffer
        // 30px buffer is extremely generous to ensure hits register
        const hitBuffer = 30; 
        const hitRadius = f.radius + hitBuffer;

        if (distSq < hitRadius * hitRadius) {
           const vx = x2 - x1;
           const vy = y2 - y1;
           sliceFruit(f, i, vx, vy);
        }
     }
  }, [sliceFruit]);


  // --- EVENT HANDLERS (POINTER API) ---
  
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    stateRef.current.isMouseDown = true;
    stateRef.current.mouseX = x;
    stateRef.current.mouseY = y;
    stateRef.current.mouseVx = 0;
    stateRef.current.mouseVy = 0;
    stateRef.current.lastInputTime = performance.now();
    
    // Start trail
    stateRef.current.trail = [{ x, y, age: BLADE_LIFETIME }];
    
    // Enable Sound
    soundManager.init();

    // Immediate "Click" Slice check
    checkForSlice(x, y, x, y, true);
    
    // Visual feedback for click
    stateRef.current.particles.push({
        id: Math.random().toString(),
        x, y,
        vx: 0, vy: 0,
        life: 0.2, decay: 0.05,
        color: '#FFF', size: 3, type: 'SPARK'
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!stateRef.current.isMouseDown) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const prevX = stateRef.current.mouseX;
    const prevY = stateRef.current.mouseY;

    // Check for slice along the path from prev to curr
    checkForSlice(prevX, prevY, x, y);

    // Update state
    stateRef.current.mouseX = x;
    stateRef.current.mouseY = y;
    stateRef.current.mouseVx = x - prevX;
    stateRef.current.mouseVy = y - prevY;
    stateRef.current.lastInputTime = performance.now();
    
    // Add to trail
    stateRef.current.trail.push({ x, y, age: BLADE_LIFETIME });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    stateRef.current.isMouseDown = false;
    stateRef.current.trail = [];
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };


  // --- MAIN LOOP EFFECT ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const handleResize = () => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
        stateRef.current.width = canvas.width;
        stateRef.current.height = canvas.height;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    const spawnFruit = () => {
      const { width, height, difficulty } = stateRef.current;
      const types = Object.keys(FRUIT_CONFIG) as FruitType[];
      
      const isBomb = Math.random() < Math.min(0.05 + (difficulty * 0.02), 0.20);
      const type = isBomb ? FruitType.BOMB : types[Math.floor(Math.random() * (types.length - 1))];
      const config = FRUIT_CONFIG[type];
      
      const x = Math.random() * (width - 100) + 50;
      const y = height + config.radius;
      
      // Horizontal Velocity: Aim roughly towards center, but SLOWER
      // Reduced multiplier from 0.005 to 0.002 for slower horizontal movement
      const vx = (width / 2 - x) * (0.0015 + Math.random() * 0.002);
      
      // Vertical Velocity
      const targetHeight = height * (0.5 + Math.random() * 0.3); // 50-80% screen height
      const requiredVy = Math.sqrt(2 * GRAVITY * targetHeight);
      const vy = -(requiredVy + (Math.random() * 1.5)); 
      
      stateRef.current.fruits.push({
        id: Math.random().toString(36).substr(2, 9),
        x, y, vx, vy,
        rotation: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.1,
        scale: 1,
        color: config.color,
        type,
        isSliced: false,
        isDead: false,
        radius: config.radius
      });
    };

    const drawFruit = (f: Entity) => {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rotation);
      
      const config = FRUIT_CONFIG[f.type];

      if (f.isSliced) {
         // Draw halves
         ctx.beginPath();
         ctx.arc(0, 0, f.radius, 0, Math.PI, false);
         ctx.closePath();
         ctx.fillStyle = config.color;
         ctx.fill();
         ctx.fillStyle = '#fff'; 
         ctx.fill(); 
         ctx.beginPath();
         ctx.arc(0, 0, f.radius - 4, 0, Math.PI, false);
         ctx.fillStyle = config.juice;
         ctx.fill();
      } else {
        if (f.type === FruitType.BOMB) {
           ctx.beginPath();
           ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
           ctx.fillStyle = '#151515';
           ctx.fill();
           
           // Glowing red core pulses
           const pulse = (Math.sin(performance.now() / 200) + 1) / 2; // 0 to 1
           ctx.beginPath();
           ctx.arc(0, 0, f.radius * 0.4, 0, Math.PI * 2);
           ctx.fillStyle = `rgba(255, 50, 0, ${0.5 + pulse * 0.5})`;
           ctx.fill();

           // Fuse
           ctx.beginPath();
           ctx.moveTo(0, -f.radius);
           ctx.quadraticCurveTo(10, -f.radius - 15, 20, -f.radius - 10);
           ctx.strokeStyle = '#8d6e63';
           ctx.lineWidth = 4;
           ctx.stroke();
           
           // Spark at end of fuse
           if (Math.random() > 0.3) {
              ctx.beginPath();
              ctx.arc(20, -f.radius - 10, 4 + Math.random()*3, 0, Math.PI * 2);
              ctx.fillStyle = '#ffeb3b';
              ctx.fill();
           }
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
          ctx.fillStyle = config.color;
          ctx.fill();
          
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.beginPath();
          ctx.arc(-f.radius*0.3, -f.radius*0.3, f.radius*0.2, 0, Math.PI*2);
          ctx.fill();
          
          if (f.type === FruitType.WATERMELON) {
             ctx.strokeStyle = '#1e8449';
             ctx.lineWidth = 3;
             ctx.beginPath();
             ctx.arc(0, 0, f.radius - 1, 0, Math.PI * 2);
             ctx.stroke();
             // Stripes
             for(let i=0; i<6; i++) {
                ctx.save();
                ctx.rotate(i * Math.PI/3);
                ctx.beginPath();
                ctx.moveTo(0,0);
                ctx.lineTo(f.radius, 0);
                ctx.stroke();
                ctx.restore();
             }
          }
        }
      }
      ctx.restore();
    };

    let animationFrameId: number;
    const loop = () => {
      if (gameState !== GameState.PLAYING && gameState !== GameState.MENU) {
         // Just keep drawing last frame or black
         if (gameState === GameState.GAME_OVER) {
            // Optional: static background
         }
      }

      const { width, height, trail, fruits, particles, floatingTexts } = stateRef.current;

      // Clear / Background
      ctx.fillStyle = '#1e1e1e'; 
      const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width);
      gradient.addColorStop(0, '#2c3e50');
      gradient.addColorStop(1, '#111');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      if (gameState === GameState.PLAYING) {
        stateRef.current.frameCount++;
        stateRef.current.difficulty += 0.0001;

        // Spawning
        const currentSpawnRate = Math.max(SPAWN_RATE_MIN, SPAWN_RATE_INITIAL - (stateRef.current.difficulty * 50));
        if (stateRef.current.frameCount % Math.floor(currentSpawnRate) === 0) {
           spawnFruit();
        }
        
        // Combo Timer
        if (stateRef.current.comboTimer > 0) {
          stateRef.current.comboTimer--;
        } else {
          stateRef.current.comboCount = 0;
        }
      }

      // Render Trail
      if (trail.length > 0) {
        ctx.beginPath();
        if (trail.length === 1) {
           // Draw a dot for click
           ctx.arc(trail[0].x, trail[0].y, BLADE_WIDTH/2, 0, Math.PI*2);
           ctx.fillStyle = BLADE_COLOR;
           ctx.fill();
        } else {
           ctx.moveTo(trail[0].x, trail[0].y);
           for (let i = 1; i < trail.length; i++) {
              const xc = (trail[i].x + trail[i-1].x) / 2;
              const yc = (trail[i].y + trail[i-1].y) / 2;
              ctx.quadraticCurveTo(trail[i-1].x, trail[i-1].y, xc, yc);
           }
           ctx.lineTo(trail[trail.length-1].x, trail[trail.length-1].y);
           ctx.lineCap = 'round';
           ctx.lineJoin = 'round';
           ctx.lineWidth = BLADE_WIDTH;
           ctx.strokeStyle = BLADE_COLOR;
           ctx.shadowBlur = 20;
           ctx.shadowColor = BLADE_GLOW;
           ctx.stroke();
           ctx.shadowBlur = 0;
        }
        
        // Age trail
        if (gameState === GameState.PLAYING || gameState === GameState.MENU) {
           for (let i = trail.length - 1; i >= 0; i--) {
             trail[i].age--;
             if (trail[i].age <= 0) trail.splice(i, 1);
           }
        }
      }

      // Update & Draw Fruits
      for (let i = fruits.length - 1; i >= 0; i--) {
        const f = fruits[i];
        
        if (gameState === GameState.PLAYING) {
          f.x += f.vx;
          f.y += f.vy;
          f.vy += GRAVITY;
          f.rotation += f.vr;
        }

        // Out of bounds
        if (f.y > height + 100) {
          if (!f.isSliced && f.type !== FruitType.BOMB && !f.isDead) {
             if (gameState === GameState.PLAYING) {
               stateRef.current.lives--;
               onLivesUpdate(stateRef.current.lives);
               f.isDead = true;
               if (stateRef.current.lives <= 0) onGameOver();
             }
          }
          if (f.y > height + 400) {
             fruits.splice(i, 1);
          }
          continue;
        }
        
        drawFruit(f);
      }

      // Update & Draw Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += GRAVITY * 0.5;
        p.life -= p.decay;
        if (p.rotation) p.rotation += p.vRotation || 0;

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
           ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
        } else if (p.type === 'SPARK') {
           ctx.beginPath();
           ctx.moveTo(p.x, p.y);
           ctx.lineTo(p.x + p.vx*2, p.y + p.vy*2);
           ctx.strokeStyle = p.color;
           ctx.lineWidth = 2;
           ctx.stroke();
        } else {
           ctx.beginPath();
           ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
           ctx.fill();
        }
        ctx.restore();
      }

      // Update & Draw Text
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

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [gameState, onGameOver, onScoreUpdate, onLivesUpdate, checkForSlice]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute top-0 left-0 w-full h-full cursor-crosshair touch-none"
      style={{ touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  );
};