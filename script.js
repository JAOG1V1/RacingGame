'use strict';
// ============================================================
// CONSTANTS & MATH
// ============================================================
const PI = Math.PI;
const PI2 = Math.PI * 2;
const HP = Math.PI / 2;
const IS_TOUCH = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }
function dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx*dx + dy*dy); }
function rng(lo, hi) { return lo + Math.random() * (hi - lo); }
function normalizeAngle(a) { while (a > PI) a -= PI2; while (a < -PI) a += PI2; return a; }
function angleDiff(a, b) { return normalizeAngle(b - a); }
function formatTime(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const t = Math.floor((ms % 1000) / 100);
  return m + ':' + String(s).padStart(2,'0') + '.' + t;
}
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2*p1) + (-p0+p2)*t + (2*p0-5*p1+4*p2-p3)*t2 + (-p0+3*p1-3*p2+p3)*t3);
}

// ============================================================
// CONFIG
// ============================================================
const CARS = [
  { name:'Speedster', topSpeed:180, accel:0.28, brake:0.35, grip:0.88, nitroMax:100 },
  { name:'Thunder',   topSpeed:170, accel:0.32, brake:0.32, grip:0.85, nitroMax:110 },
  { name:'Phantom',   topSpeed:195, accel:0.24, brake:0.38, grip:0.92, nitroMax:90  },
  { name:'Titan',     topSpeed:150, accel:0.36, brake:0.42, grip:0.80, nitroMax:120 }
];
const COLORS = ['#e83030','#3080ff','#20c060','#f0c030','#cc40cc','#ff8020','#20cccc','#ffffff'];
const TRACKS = [
  {
    name:'Grand Circuit',
    center:[3200,2800],
    points:[
      {r:1200,a:0},{r:1240,a:0.22},{r:1160,a:0.45},{r:1050,a:0.68},
      {r:940,a:0.92},{r:880,a:1.18},{r:960,a:1.45},{r:1080,a:1.68},
      {r:1180,a:1.90},{r:1280,a:2.15},{r:1300,a:2.42},{r:1250,a:2.70},
      {r:1120,a:2.98},{r:980,a:3.22},{r:860,a:3.48},{r:760,a:3.75},
      {r:800,a:4.02},{r:920,a:4.28},{r:1040,a:4.55},{r:1140,a:4.82},
      {r:1200,a:5.10},{r:1240,a:5.35},{r:1260,a:5.60},{r:1240,a:5.85},
      {r:1220,a:6.10},{r:1200,a:6.28}
    ]
  },
  {
    name:'Tight Twister',
    center:[3000,2600],
    points:[
      {r:820,a:0},{r:780,a:0.35},{r:650,a:0.72},{r:520,a:1.08},
      {r:460,a:1.42},{r:520,a:1.78},{r:680,a:2.12},{r:820,a:2.48},
      {r:940,a:2.82},{r:980,a:3.14},{r:940,a:3.50},{r:820,a:3.86},
      {r:660,a:4.22},{r:520,a:4.58},{r:480,a:4.92},{r:540,a:5.28},
      {r:680,a:5.62},{r:780,a:5.96},{r:820,a:6.28}
    ]
  },
  {
    name:'Oval Speedway',
    center:[3200,2800],
    points:[
      {r:1100,a:0},{r:1060,a:0.30},{r:700,a:0.65},{r:640,a:1.00},
      {r:620,a:1.57},{r:640,a:2.14},{r:700,a:2.49},{r:1060,a:2.84},
      {r:1100,a:3.14},{r:1060,a:3.44},{r:700,a:3.79},{r:640,a:4.14},
      {r:620,a:4.71},{r:640,a:5.28},{r:700,a:5.63},{r:1060,a:5.98},
      {r:1100,a:6.28}
    ]
  },
  {
    name:'Mountain Pass',
    center:[3400,3000],
    points:[
      {r:1400,a:0},{r:1350,a:0.18},{r:1200,a:0.38},{r:1020,a:0.60},
      {r:860,a:0.82},{r:720,a:1.05},{r:650,a:1.30},{r:680,a:1.58},
      {r:780,a:1.82},{r:920,a:2.06},{r:1100,a:2.28},{r:1280,a:2.50},
      {r:1380,a:2.72},{r:1420,a:2.96},{r:1350,a:3.20},{r:1180,a:3.45},
      {r:980,a:3.70},{r:800,a:3.95},{r:680,a:4.22},{r:640,a:4.52},
      {r:700,a:4.82},{r:860,a:5.10},{r:1040,a:5.36},{r:1220,a:5.60},
      {r:1360,a:5.82},{r:1400,a:6.05},{r:1400,a:6.28}
    ]
  },
  {
    name:'Desert Sprint',
    center:[3000,2600],
    points:[
      {r:900,a:0},{r:1050,a:0.25},{r:1200,a:0.55},{r:1300,a:0.88},
      {r:1280,a:1.20},{r:1150,a:1.50},{r:920,a:1.72},{r:760,a:1.95},
      {r:700,a:2.20},{r:740,a:2.50},{r:860,a:2.78},{r:1020,a:3.05},
      {r:1180,a:3.30},{r:1300,a:3.55},{r:1320,a:3.82},{r:1250,a:4.10},
      {r:1080,a:4.38},{r:900,a:4.65},{r:740,a:4.92},{r:680,a:5.22},
      {r:720,a:5.52},{r:820,a:5.78},{r:900,a:6.05},{r:900,a:6.28}
    ]
  }
];
const DIFFICULTIES = [
  {name:'Easy',   skill:0.60},
  {name:'Medium', skill:0.75},
  {name:'Hard',   skill:0.88},
  {name:'Expert', skill:1.00}
];
const WEATHERS = ['Clear','Rain','Storm','Night','Dynamic'];
const ITEM_TYPES = ['shield','boost','missile','oil','magnet','repair','nitro_refill','mine','lightning','ghost_mode'];
const ITEM_EMOJI = {shield:'🛡',boost:'⚡',missile:'🚀',oil:'🛢',magnet:'🧲',repair:'🔧',nitro_refill:'💧',mine:'💣',lightning:'⚡',ghost_mode:'👻'};
const AI_NAMES = ['Blaze','Nova','Ghost','Viper','Storm','Titan','Raven','Spike','Cruz','Neon','Axel','Drift'];
const AI_COLORS = ['#ff4444','#44aaff','#44ff88','#ffcc00','#ff44ff','#ff8800','#00ffcc','#8888ff','#ff6666','#66ff66'];
// Unique personality traits per named AI (aggression, caution, itemStrategy, consistency)
const AI_PERSONALITIES = {
  'Blaze':  { aggression: 0.90, caution: 0.30, itemStrategy: 0.70, consistency: 0.80 },
  'Nova':   { aggression: 0.60, caution: 0.60, itemStrategy: 0.80, consistency: 0.90 },
  'Ghost':  { aggression: 0.40, caution: 0.90, itemStrategy: 0.90, consistency: 0.95 },
  'Viper':  { aggression: 0.75, caution: 0.65, itemStrategy: 1.00, consistency: 0.85 },
  'Storm':  { aggression: 0.85, caution: 0.40, itemStrategy: 0.60, consistency: 0.70 },
  'Titan':  { aggression: 0.50, caution: 0.80, itemStrategy: 0.70, consistency: 0.90 },
  'Raven':  { aggression: 0.75, caution: 0.55, itemStrategy: 0.85, consistency: 0.80 },
  'Spike':  { aggression: 0.95, caution: 0.20, itemStrategy: 0.50, consistency: 0.60 },
  'Cruz':   { aggression: 0.60, caution: 0.70, itemStrategy: 0.75, consistency: 0.85 },
  'Neon':   { aggression: 0.70, caution: 0.55, itemStrategy: 0.80, consistency: 0.75 },
  'Axel':   { aggression: 0.80, caution: 0.45, itemStrategy: 0.65, consistency: 0.70 },
  'Drift':  { aggression: 0.70, caution: 0.60, itemStrategy: 0.70, consistency: 0.65 }
};
const TOTAL_LAPS = 5;
const ROAD_WIDTH = 220;
const WALL_HIT_COOLDOWN_MS = 300;
const PLAYER_WALL_RESTITUTION = 0.35;
const PLAYER_WALL_SPEED_FACTOR = 0.5;
const AI_WALL_RESTITUTION = 0.2;
const AI_WALL_SPEED_FACTOR = 0.6;
const AI_ITEM_USE_RATE = 0.0015;       // probability per ms that AI uses an item (legacy, replaced by strategic system)
const AI_BASE_GRIP_MULTIPLIER = 0.9;   // AI grip is slightly softer than ideal to simulate realistic handling
const RUBBER_BAND_THRESHOLD = 300;     // distance gap before rubber-banding kicks in
const RUBBER_BAND_CATCH_UP = 4000;     // divisor for catch-up factor (larger = gentler)
const RUBBER_BAND_SLOW_DOWN = 5000;    // divisor for slow-down factor
const RUBBER_BAND_MAX_BOOST = 0.12;    // max rubber-band speed multiplier (catch-up)
const RUBBER_BAND_MAX_SLOW = 0.08;     // max rubber-band speed reduction (slow-down)
const CAMERA_DAMPING = 5;             // camera follow damping lambda
const CAMERA_LOOKAHEAD_FWD = 80;      // camera lookahead distance (forward)
const CAMERA_LOOKAHEAD_REV = 110;     // camera lookahead distance (rear view)

// ============================================================
// AUDIO ENGINE
// ============================================================
class AudioEngine {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.osc1 = null; this.osc2 = null; this.drone = null;
    this.gainNode = null; this.filterNode = null;
    this._started = false;
  }
  _init() {
    if (this._started) return;
    this._started = true;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = 0.18;
      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.value = 800;
      const wave = this.ctx.createWaveShaper();
      const n = 256, curve = new Float32Array(n);
      for (let i = 0; i < n; i++) { const x = (i*2/n)-1; curve[i] = (3+20)*x*20*PI/180/(PI*(3+Math.abs(20*x))); }
      wave.curve = curve;
      this.osc1 = this.ctx.createOscillator();
      this.osc1.type = 'sawtooth';
      this.osc1.frequency.value = 80;
      this.osc2 = this.ctx.createOscillator();
      this.osc2.type = 'square';
      this.osc2.frequency.value = 40;
      this.drone = this.ctx.createOscillator();
      this.drone.type = 'sine';
      this.drone.frequency.value = 55;
      const g1 = this.ctx.createGain(); g1.gain.value = 0.6;
      const g2 = this.ctx.createGain(); g2.gain.value = 0.3;
      const g3 = this.ctx.createGain(); g3.gain.value = 0.2;
      this.osc1.connect(g1); g1.connect(wave);
      this.osc2.connect(g2); g2.connect(wave);
      this.drone.connect(g3); g3.connect(wave);
      wave.connect(this.filterNode);
      this.filterNode.connect(this.gainNode);
      this.gainNode.connect(this.ctx.destination);
      this.osc1.start(); this.osc2.start(); this.drone.start();
    } catch(e) { this.enabled = false; }
  }
  start() { this._init(); }
  setEngine(rpm, speed) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const freq = 60 + rpm * 0.06;
    const filt = 400 + speed * 4;
    this.osc1.frequency.setTargetAtTime(freq, t, 0.05);
    this.osc2.frequency.setTargetAtTime(freq * 0.5, t, 0.05);
    this.filterNode.frequency.setTargetAtTime(clamp(filt, 200, 3000), t, 0.05);
    this.gainNode.gain.setTargetAtTime(this.enabled ? 0.18 : 0, t, 0.05);
  }
  playEffect(type) {
    if (!this.enabled || !this.ctx) return;
    const ac = this.ctx;
    const t = ac.currentTime;
    const g = ac.createGain();
    g.connect(ac.destination);
    const o = ac.createOscillator();
    o.connect(g);
    switch(type) {
      case 'screech': o.type='sawtooth'; o.frequency.value=300; g.gain.setValueAtTime(0.3,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.4); o.start(t); o.stop(t+0.4); break;
      case 'impact':  o.type='square';   o.frequency.setValueAtTime(200,t); o.frequency.exponentialRampToValueAtTime(50,t+0.2); g.gain.setValueAtTime(0.4,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.2); o.start(t); o.stop(t+0.2); break;
      case 'chime':   o.type='sine';     o.frequency.setValueAtTime(880,t); o.frequency.exponentialRampToValueAtTime(440,t+0.3); g.gain.setValueAtTime(0.2,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.3); o.start(t); o.stop(t+0.3); break;
      case 'pickup':  o.type='sine';     o.frequency.setValueAtTime(440,t); o.frequency.setValueAtTime(660,t+0.05); g.gain.setValueAtTime(0.15,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.2); o.start(t); o.stop(t+0.2); break;
      case 'powerup': o.type='sine';     o.frequency.setValueAtTime(330,t); o.frequency.exponentialRampToValueAtTime(990,t+0.4); g.gain.setValueAtTime(0.2,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.4); o.start(t); o.stop(t+0.4); break;
      case 'thunder': o.type='sawtooth'; o.frequency.setValueAtTime(60,t); o.frequency.exponentialRampToValueAtTime(20,t+0.6); g.gain.setValueAtTime(0.5,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.6); o.start(t); o.stop(t+0.6); break;
      case 'missile': o.type='sawtooth'; o.frequency.setValueAtTime(400,t); o.frequency.exponentialRampToValueAtTime(150,t+0.3); g.gain.setValueAtTime(0.25,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.3); o.start(t); o.stop(t+0.3); break;
      case 'countdown': o.type='square'; o.frequency.value=440; g.gain.setValueAtTime(0.3,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.15); o.start(t); o.stop(t+0.15); break;
      case 'go':      o.type='square';   o.frequency.value=880; g.gain.setValueAtTime(0.35,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.3); o.start(t); o.stop(t+0.3); break;
      case 'horn':    o.type='sine';     o.frequency.setValueAtTime(440,t); o.frequency.setValueAtTime(550,t+0.12); o.frequency.setValueAtTime(440,t+0.24); g.gain.setValueAtTime(0.28,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.45); o.start(t); o.stop(t+0.45); break;
    }
  }
  toggle() {
    this.enabled = !this.enabled;
    if (this.gainNode) this.gainNode.gain.value = this.enabled ? 0.18 : 0;
    return this.enabled;
  }
}

// ============================================================
// PARTICLES
// ============================================================
class Particles {
  constructor() {
    this.pool = [];
    this._freeStack = [];
    this.active = [];
    for (let i = 0; i < 1200; i++) {
      this.pool.push({alive:false, _poolIdx:i});
      this._freeStack.push(i);
    }
  }
  _get() {
    if (this._freeStack.length > 0) return this.pool[this._freeStack.pop()];
    return {alive:false, _poolIdx:-1};
  }
  emit(x, y, opts={}) {
    const p = this._get();
    p.alive = true;
    p.x = x; p.y = y;
    p.vx = opts.vx || 0; p.vy = opts.vy || 0;
    p.life = opts.life || 800;
    p.maxLife = p.life;
    p.size = opts.size || 4;
    p.color = opts.color || '#fff';
    p.drag = opts.drag !== undefined ? opts.drag : 0.97;
    p.gravity = opts.gravity || 0;
    this.active.push(p);
  }
  burst(x, y, count, opts={}) {
    for (let i = 0; i < count; i++) {
      const a = rng(0, PI2);
      const spd = rng(opts.minSpd || 30, opts.maxSpd || 100);
      this.emit(x, y, Object.assign({}, opts, { vx: Math.cos(a)*spd, vy: Math.sin(a)*spd }));
    }
  }
  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; if (p._poolIdx >= 0) this._freeStack.push(p._poolIdx); this.active.splice(i,1); continue; }
      p.vx *= p.drag; p.vy *= p.drag;
      p.vy += p.gravity * dt * 0.001;
      p.x += p.vx * dt * 0.001;
      p.y += p.vy * dt * 0.001;
    }
  }
  draw(ctx, cx, cy, W, H) {
    for (const p of this.active) {
      const sx = p.x - cx + W/2, sy = p.y - cy + H/2;
      if (sx < -20 || sx > W+20 || sy < -20 || sy > H+20) continue;
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx, sy, p.size * alpha, 0, PI2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// ============================================================
// TIRE MARKS
// ============================================================
class TireMarks {
  constructor() {
    this.marks = [];
    this.MAX = 2000;
  }
  add(x, y, heading, width) {
    if (this.marks.length >= this.MAX) this.marks.shift();
    const px = -Math.sin(heading) * 12, py = Math.cos(heading) * 12;
    this.marks.push({ x1:x+px, y1:y+py, x2:x-px, y2:y-py, age:0, maxAge:15000 });
  }
  update(dt) {
    for (const m of this.marks) m.age += dt;
  }
  prune() {
    let write = 0;
    for (let i = 0; i < this.marks.length; i++) {
      if (this.marks[i].age < this.marks[i].maxAge) this.marks[write++] = this.marks[i];
    }
    this.marks.length = write;
  }
  draw(ctx) {
    for (const m of this.marks) {
      const a = clamp(1 - m.age/m.maxAge, 0, 1) * 0.5;
      ctx.strokeStyle = `rgba(20,15,10,${a})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(m.x1, m.y1);
      ctx.lineTo(m.x2, m.y2);
      ctx.stroke();
    }
  }
}

// ============================================================
// WEATHER
// ============================================================
class Weather {
  constructor() {
    this.state = 'CLEAR';
    this.dynamic = false;
    this.cycleTimer = 0;
    this.cycleInterval = rng(20000, 38000);
    this.drops = [];
    this.lightningAlpha = 0;
    this.lightningTimer = 0;
    this.nightAlpha = 0;
    this.GRIPS = { CLEAR:1.0, RAIN:0.82, STORM:0.68, NIGHT:0.95 };
    this.STATES = ['CLEAR','RAIN','STORM','NIGHT'];
    for (let i = 0; i < 400; i++) {
      this.drops.push({ x: rng(0,800), y: rng(0,600), vx: rng(-1,1), vy: rng(8,16) });
    }
  }
  setWeather(type) {
    if (type === 'Dynamic') { this.dynamic = true; this.state = 'CLEAR'; }
    else { this.dynamic = false; this.state = type.toUpperCase(); }
    this.nightAlpha = this.state === 'NIGHT' ? 0.5 : 0;
  }
  getGrip() { return this.GRIPS[this.state] || 1.0; }
  update(dt) {
    if (this.dynamic) {
      this.cycleTimer += dt;
      if (this.cycleTimer >= this.cycleInterval) {
        this.cycleTimer = 0;
        this.cycleInterval = rng(20000,38000);
        const idx = (this.STATES.indexOf(this.state) + 1) % this.STATES.length;
        this.state = this.STATES[idx];
      }
    }
    if (this.state === 'NIGHT') this.nightAlpha = damp(this.nightAlpha, 0.55, 3, dt*0.001);
    else this.nightAlpha = damp(this.nightAlpha, 0, 3, dt*0.001);
    if (this.state === 'STORM') {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningAlpha = 0.7;
        this.lightningTimer = rng(3000,8000);
      }
      this.lightningAlpha *= 0.92;
    } else { this.lightningAlpha = 0; }
  }
  draw(ctx, W, H, px, py, heading) {
    if (this.nightAlpha > 0.01) {
      ctx.save();
      ctx.setTransform(1,0,0,1,0,0);
      ctx.fillStyle = `rgba(0,0,20,${this.nightAlpha})`;
      ctx.fillRect(0,0,W,H);
      // headlight cone
      const cx2 = W/2, cy2 = H/2;
      const grad = ctx.createRadialGradient(cx2,cy2,10,cx2,cy2,280);
      grad.addColorStop(0,'rgba(255,250,200,0.18)');
      grad.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      const ha = heading + PI/2;
      ctx.moveTo(cx2,cy2);
      ctx.arc(cx2,cy2,280,ha-0.5,ha+0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    if (this.lightningAlpha > 0.01) {
      ctx.save();
      ctx.setTransform(1,0,0,1,0,0);
      ctx.fillStyle = `rgba(200,220,255,${this.lightningAlpha})`;
      ctx.fillRect(0,0,W,H);
      ctx.restore();
    }
    if (this.state === 'RAIN' || this.state === 'STORM') {
      const count = this.state === 'STORM' ? 400 : 220;
      ctx.save();
      ctx.setTransform(1,0,0,1,0,0);
      ctx.strokeStyle = 'rgba(180,200,255,0.5)';
      ctx.lineWidth = 1;
      for (let i = 0; i < count; i++) {
        const d = this.drops[i];
        d.x += d.vx; d.y += d.vy;
        if (d.x > W) d.x -= W; if (d.x < 0) d.x += W;
        if (d.y > H) { d.y -= H; d.x = rng(0,W); }
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + d.vx*2, d.y + d.vy*2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  getIndicatorText() {
    const icons = {CLEAR:'☀️',RAIN:'🌧️',STORM:'⛈️',NIGHT:'🌙'};
    return (icons[this.state]||'🌤') + ' ' + this.state;
  }
}

// ============================================================
// ITEM BOX
// ============================================================
class ItemBox {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.bobTimer = Math.random() * PI2;
    this.active = true;
    this.respawnTimer = 0;
  }
  update(dt) {
    this.bobTimer += 0.003 * dt;
    if (!this.active) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.active = true;
    }
  }
  collect(player) {
    if (!this.active) return false;
    const item = ITEM_TYPES[Math.floor(Math.random()*ITEM_TYPES.length)];
    player.addItem(item);
    this.active = false;
    this.respawnTimer = rng(7000,14000);
    return true;
  }
  draw(ctx) {
    if (!this.active) return;
    const bob = Math.sin(this.bobTimer) * 4;
    ctx.save();
    ctx.translate(this.x, this.y + bob);
    const grad = ctx.createRadialGradient(0,0,4,0,0,18);
    grad.addColorStop(0,'rgba(255,240,80,0.9)');
    grad.addColorStop(1,'rgba(255,180,0,0.2)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0,0,18,0,PI2); ctx.fill();
    ctx.strokeStyle='rgba(255,220,60,0.8)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(0,0,16,0,PI2); ctx.stroke();
    ctx.fillStyle='#fff'; ctx.font='14px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('?',0,0);
    ctx.restore();
  }
}

// ============================================================
// OIL SLICK
// ============================================================
class OilSlick {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.rotation = Math.random()*PI2;
    this.radiusX = 55; this.radiusY = 35;
    this.lifetime = 14000; this.maxLife = 14000;
    this.active = true;
  }
  update(dt) {
    if (!this.active) return;
    this.lifetime -= dt;
    if (this.lifetime <= 0) this.active = false;
  }
  draw(ctx) {
    if (!this.active) return;
    const a = clamp(this.lifetime/this.maxLife,0,1)*0.6;
    ctx.save();
    ctx.translate(this.x,this.y);
    ctx.rotate(this.rotation);
    ctx.globalAlpha = a;
    ctx.fillStyle='rgba(20,15,5,0.85)';
    ctx.beginPath();
    ctx.ellipse(0,0,this.radiusX,this.radiusY,0,0,PI2);
    ctx.fill();
    ctx.globalAlpha=1;
    ctx.restore();
  }
}

// ============================================================
// MISSILE
// ============================================================
class Missile {
  constructor(x, y, heading, particles) {
    this.x = x; this.y = y;
    this.heading = heading;
    this.speed = 700;
    this.lifetime = 3000;
    this.active = true;
    this.particles = particles;
    this.owner = null; // set after creation to identify who fired it
  }
  update(dt, cars) {
    if (!this.active) return;
    this.lifetime -= dt;
    if (this.lifetime <= 0) { this.active = false; return; }
    const s = dt * 0.001;
    this.x += Math.cos(this.heading) * this.speed * s;
    this.y += Math.sin(this.heading) * this.speed * s;
    // trail
    if (this.particles) this.particles.emit(this.x, this.y, { color:'#ff8030', size:5, life:300, vx:rng(-20,20), vy:rng(-20,20), drag:0.9 });
    // hit detection
    for (const car of cars) {
      if (car === this.owner) continue; // never hit the car that fired this missile
      if (dist(this.x, this.y, car.x, car.y) < 30) {
        // Ghost mode: missile passes through
        if (car.activeEffects && car.activeEffects.ghost_mode > 0) continue;
        // Shield: deflect missile without harming car
        if (car.activeEffects && car.activeEffects.shield > 0) {
          this.active = false;
          if (this.particles) this.particles.burst(this.x,this.y,8,{color:'#44aaff',minSpd:60,maxSpd:140,life:400});
          return;
        }
        car.angularVel = (Math.random()-0.5)*2;
        car.speed *= 0.3;
        // Stun AI cars briefly after missile impact
        if (car.stunTimer !== undefined) car.stunTimer = 600;
        this.active = false;
        if (this.particles) this.particles.burst(this.x,this.y,12,{color:'#ff4400',minSpd:80,maxSpd:200,life:500});
        return;
      }
    }
  }
  draw(ctx) {
    if (!this.active) return;
    ctx.save();
    ctx.translate(this.x,this.y);
    ctx.rotate(this.heading);
    ctx.fillStyle='#ffcc00';
    ctx.beginPath(); ctx.ellipse(0,0,5,12,0,0,PI2); ctx.fill();
    ctx.fillStyle='#ff4400';
    ctx.beginPath(); ctx.ellipse(0,8,4,8,0,0,PI2); ctx.fill();
    ctx.restore();
  }
}

// ============================================================
// GHOST
// ============================================================
class Ghost {
  constructor() {
    this.frames = [];
    this.bestLap = null;
    this.playing = false;
    this.playIdx = 0;
  }
  record(x, y, heading) { this.frames.push({x,y,heading}); }
  saveLap(lapTime) {
    if (!this.bestLapTime || lapTime < this.bestLapTime) {
      this.bestLapTime = lapTime;
      this.bestLap = this.frames.slice();
    }
    this.frames = [];
  }
  startPlayback() { if (this.bestLap) { this.playing = true; this.playIdx = 0; } }
  getFrame() {
    if (!this.playing || !this.bestLap) return null;
    const f = this.bestLap[this.playIdx % this.bestLap.length];
    this.playIdx++;
    return f;
  }
  reset() { this.frames = []; this.playing = false; this.playIdx = 0; }
  draw(ctx, frame) {
    if (!frame) return;
    ctx.save();
    ctx.translate(frame.x, frame.y);
    ctx.rotate(frame.heading + PI/2);
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-17,-29,34,58);
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

// ============================================================
// TRACK
// ============================================================
class Track {
  constructor(config) {
    this.config = config;
    this.center = config.center;
    this.roadWidth = ROAD_WIDTH;
    this.spline = [];
    this.normals = [];
    this.cumLen = [];
    this.totalLen = 0;
    this.itemBoxes = [];
    this.trees = [];
    this.grandstands = [];
    this._buildSpline();
    this._placeTrees();
    this._placeGrandstands();
    this._placeItems();
  }
  _buildSpline() {
    const pts = this.config.points;
    const raw = pts.map(p => ({
      x: this.center[0] + p.r * Math.cos(p.a),
      y: this.center[1] + p.r * Math.sin(p.a)
    }));
    const N = raw.length;
    const segs = 16;
    for (let i = 0; i < N; i++) {
      const p0 = raw[(i-1+N)%N], p1 = raw[i], p2 = raw[(i+1)%N], p3 = raw[(i+2)%N];
      for (let s = 0; s < segs; s++) {
        const t = s / segs;
        const x = catmullRom(p0.x,p1.x,p2.x,p3.x,t);
        const y = catmullRom(p0.y,p1.y,p2.y,p3.y,t);
        this.spline.push({x,y});
      }
    }
    // normals and arc lengths
    const SN = this.spline.length;
    this.cumLen = [0];
    for (let i = 0; i < SN; i++) {
      const a = this.spline[i], b = this.spline[(i+1)%SN];
      const dx = b.x-a.x, dy = b.y-a.y;
      const len = Math.sqrt(dx*dx+dy*dy);
      const nx = -dy/len, ny = dx/len;
      this.normals.push({nx,ny});
      this.cumLen.push(this.cumLen[i]+len);
    }
    this.totalLen = this.cumLen[SN];
    // Build spatial grid for O(1) nearest lookup
    this._buildGrid();
    // Precompute grass texture dots (decorative) with wildflowers
    this._grassDots = [];
    const flowerColors = ['#ffdd22','#ffffff','#cc44cc','#ff8844','#44aaff'];
    for (let i = 0; i < SN; i += 3) {
      const sp = this.spline[i];
      const nx = this.normals[i].nx, ny = this.normals[i].ny;
      for (let side = -1; side <= 1; side += 2) {
        const off = rng(ROAD_WIDTH/2 + 16, ROAD_WIDTH/2 + 160);
        const isFlower = Math.random() < 0.12;
        this._grassDots.push({
          x: sp.x + nx * off * side + rng(-12, 12),
          y: sp.y + ny * off * side + rng(-12, 12),
          r: isFlower ? rng(2, 3.5) : rng(1, 3.5),
          dark: Math.random() > 0.55,
          flower: isFlower,
          flowerColor: flowerColors[Math.floor(Math.random()*flowerColors.length)]
        });
      }
    }
    // Precompute gravel dots (between shoulder and road)
    this._gravelDots = [];
    for (let i = 0; i < SN; i += 2) {
      const sp = this.spline[i];
      const nx = this.normals[i].nx, ny = this.normals[i].ny;
      for (let side = -1; side <= 1; side += 2) {
        const off = rng(ROAD_WIDTH/2 + 2, ROAD_WIDTH/2 + 28);
        this._gravelDots.push({
          x: sp.x + nx * off * side + rng(-4, 4),
          y: sp.y + ny * off * side + rng(-4, 4),
          r: rng(1.5, 3.5)
        });
      }
    }
    // Precompute asphalt surface patches (subtle road variation)
    this._asphaltPatches = [];
    for (let i = 0; i < SN; i += 5) {
      if (Math.random() > 0.45) continue;
      const sp = this.spline[i];
      const nx = this.normals[i].nx, ny = this.normals[i].ny;
      const off = rng(-(ROAD_WIDTH/2 - 28), ROAD_WIDTH/2 - 28);
      this._asphaltPatches.push({
        x: sp.x + nx * off, y: sp.y + ny * off,
        w: rng(14, 52), h: rng(7, 22), a: Math.random() * PI2
      });
    }
    // Precompute advertising banners (placed at regular intervals beside track)
    this._banners = [];
    const bannerData = [
      {bg:'#e83030',fg:'#ffffff',text:'TURBO'},
      {bg:'#2255cc',fg:'#ffff00',text:'SPEED'},
      {bg:'#228822',fg:'#ffffff',text:'RACE'},
      {bg:'#ff8800',fg:'#111111',text:'NITRO'},
      {bg:'#8822aa',fg:'#ffffff',text:'APEX'},
      {bg:'#111111',fg:'#ff3333',text:'DRIFT'}
    ];
    const bannerStep = Math.max(1, Math.floor(SN / 18));
    for (let i = 0; i < SN; i += bannerStep) {
      const sp = this.spline[i];
      const nn = this.normals[i];
      for (let side = -1; side <= 1; side += 2) {
        if (Math.random() < 0.45) continue;
        const off = ROAD_WIDTH/2 + 38;
        const bd = bannerData[Math.floor(Math.random()*bannerData.length)];
        this._banners.push({
          x: sp.x + nn.nx*off*side,
          y: sp.y + nn.ny*off*side,
          angle: Math.atan2(nn.ny, nn.nx) + PI/2,
          w: rng(52, 80), h: rng(14, 20),
          bg: bd.bg, fg: bd.fg, text: bd.text
        });
      }
    }
  }
  _buildGrid() {
    const CELL = 200;
    this._gridCell = CELL;
    this._grid = {};
    for (let i = 0; i < this.spline.length; i++) {
      const sp = this.spline[i];
      const cx = Math.floor(sp.x / CELL);
      const cy = Math.floor(sp.y / CELL);
      const key = cx + ',' + cy;
      if (!this._grid[key]) this._grid[key] = [];
      this._grid[key].push(i);
    }
  }
  nearest(x, y) {
    const SN = this.spline.length;
    const CELL = this._gridCell;
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    let bestDist = Infinity, bestIdx = 0;
    // Check 5x5 grid cells (radius 2) around the car position
    for (let dcx = -2; dcx <= 2; dcx++) {
      for (let dcy = -2; dcy <= 2; dcy++) {
        const key = (cx + dcx) + ',' + (cy + dcy);
        const cell = this._grid[key];
        if (!cell) continue;
        for (const i of cell) {
          const sp = this.spline[i];
          const dx = x - sp.x, dy = y - sp.y;
          const d = Math.sqrt(dx*dx + dy*dy);
          if (d < bestDist) { bestDist = d; bestIdx = i; }
        }
      }
    }
    // Fallback: if grid missed (car far off track), scan all points
    if (bestDist === Infinity) {
      for (let i = 0; i < SN; i++) {
        const sp = this.spline[i];
        const d = dist(x,y,sp.x,sp.y);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
    }
    return { idx: bestIdx, dist: bestDist, nx: this.normals[bestIdx].nx, ny: this.normals[bestIdx].ny };
  }
  onRoad(x, y) { return this.nearest(x,y).dist < this.roadWidth/2 + 20; }
  curvatureAt(idx) {
    const SN = this.spline.length;
    const a = this.spline[(idx-1+SN)%SN];
    const b = this.spline[idx];
    const c = this.spline[(idx+1)%SN];
    const d1x = b.x-a.x, d1y = b.y-a.y;
    const d2x = c.x-b.x, d2y = c.y-b.y;
    const l1 = Math.sqrt(d1x*d1x+d1y*d1y), l2 = Math.sqrt(d2x*d2x+d2y*d2y);
    if (l1<0.001||l2<0.001) return 0;
    return Math.abs((d1x/l1)*(d2x/l2)+(d1y/l1)*(d2y/l2));
  }
  _placeItems() {
    const SN = this.spline.length;
    const step = Math.floor(SN / 12);
    for (let i = 0; i < 12; i++) {
      const sp = this.spline[(i * step + Math.floor(step/2)) % SN];
      this.itemBoxes.push(new ItemBox(sp.x, sp.y));
    }
  }
  _placeTrees() {
    const SN = this.spline.length;
    for (let i = 0; i < 80; i++) {
      const idx = Math.floor(Math.random()*SN);
      const sp = this.spline[idx];
      const side = Math.random() > 0.5 ? 1 : -1;
      const offset = rng(ROAD_WIDTH/2+30, ROAD_WIDTH/2+160);
      const nx = this.normals[idx].nx, ny = this.normals[idx].ny;
      this.trees.push({ x: sp.x + nx*offset*side, y: sp.y + ny*offset*side, r: rng(12,26) });
    }
  }
  _placeGrandstands() {
    const SN = this.spline.length;
    const step = Math.floor(SN/6);
    for (let i = 0; i < 6; i++) {
      const idx = (i*step + 10)%SN;
      const sp = this.spline[idx];
      const nx = this.normals[idx].nx, ny = this.normals[idx].ny;
      const angle = Math.atan2(ny,nx);
      this.grandstands.push({ x: sp.x+nx*180, y: sp.y+ny*180, w:120, h:40, angle });
    }
  }
  draw(ctx) {
    const SN = this.spline.length;
    // Grass background is drawn by the game loop
    // Wildflower dots (colored) mixed with grass texture
    for (const d of this._grassDots) {
      if (d.flower) {
        ctx.fillStyle = d.flowerColor;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r * 1.4, 0, PI2); ctx.fill();
      } else {
        ctx.fillStyle = d.dark ? '#2a5c18' : '#3d7a28';
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, PI2); ctx.fill();
      }
    }
    // Gravel trap (tan strip between shoulder and road)
    ctx.strokeStyle='#d4b88a'; ctx.lineWidth=ROAD_WIDTH+52;
    ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.beginPath();
    ctx.moveTo(this.spline[0].x,this.spline[0].y);
    for (let i=1;i<SN;i++) ctx.lineTo(this.spline[i].x,this.spline[i].y);
    ctx.closePath(); ctx.stroke();
    // Gravel texture (subtle dots over gravel strip)
    ctx.fillStyle='rgba(160,130,90,0.18)';
    for (const p of this._gravelDots||[]) {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, PI2); ctx.fill();
    }
    // Rumble strips — kerb alternating red/white blocks
    ctx.strokeStyle='#ffffff'; ctx.lineWidth=ROAD_WIDTH+14;
    ctx.setLineDash([32,32]); ctx.lineDashOffset=0;
    ctx.beginPath();
    ctx.moveTo(this.spline[0].x,this.spline[0].y);
    for (let i=1;i<SN;i++) ctx.lineTo(this.spline[i].x,this.spline[i].y);
    ctx.closePath(); ctx.stroke();
    ctx.strokeStyle='#cc1111'; ctx.lineDashOffset=32;
    ctx.beginPath();
    ctx.moveTo(this.spline[0].x,this.spline[0].y);
    for (let i=1;i<SN;i++) ctx.lineTo(this.spline[i].x,this.spline[i].y);
    ctx.closePath(); ctx.stroke();
    ctx.setLineDash([]); ctx.lineDashOffset=0;
    // Road shadow (subtle dark edge under road)
    ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.lineWidth=ROAD_WIDTH+6;
    ctx.beginPath();
    ctx.moveTo(this.spline[0].x,this.spline[0].y);
    for (let i=1;i<SN;i++) ctx.lineTo(this.spline[i].x,this.spline[i].y);
    ctx.closePath(); ctx.stroke();
    // Asphalt road surface
    ctx.strokeStyle='#2e2e34'; ctx.lineWidth=ROAD_WIDTH;
    ctx.beginPath();
    ctx.moveTo(this.spline[0].x,this.spline[0].y);
    for (let i=1;i<SN;i++) ctx.lineTo(this.spline[i].x,this.spline[i].y);
    ctx.closePath(); ctx.stroke();
    // Road crown — slightly lighter center strip for 3D road feel
    ctx.strokeStyle='rgba(60,60,70,0.35)'; ctx.lineWidth=ROAD_WIDTH*0.45;
    ctx.beginPath();
    ctx.moveTo(this.spline[0].x,this.spline[0].y);
    for (let i=1;i<SN;i++) ctx.lineTo(this.spline[i].x,this.spline[i].y);
    ctx.closePath(); ctx.stroke();
    // Asphalt surface patches (subtle dark variation)
    ctx.fillStyle='rgba(0,0,0,0.07)';
    for (const p of this._asphaltPatches) {
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.a);
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
    }
    // Lane markings — white dashes at 1/3 and 2/3 track width
    ctx.strokeStyle='rgba(255,255,255,0.28)'; ctx.lineWidth=2; ctx.setLineDash([30,26]);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      const off = side * ROAD_WIDTH * 0.30;
      const s0 = this.spline[0], n0 = this.normals[0];
      ctx.moveTo(s0.x + n0.nx*off, s0.y + n0.ny*off);
      for (let i=1;i<SN;i++) {
        const sp = this.spline[i], nn = this.normals[i];
        ctx.lineTo(sp.x + nn.nx*off, sp.y + nn.ny*off);
      }
      ctx.closePath(); ctx.stroke();
    }
    // Center dashed line
    ctx.strokeStyle='rgba(255,224,96,0.60)'; ctx.lineWidth=3.5; ctx.setLineDash([28,22]);
    ctx.beginPath();
    ctx.moveTo(this.spline[0].x,this.spline[0].y);
    for (let i=1;i<SN;i++) ctx.lineTo(this.spline[i].x,this.spline[i].y);
    ctx.closePath(); ctx.stroke();
    ctx.setLineDash([]);
    // Advertising banners alongside the track
    for (const b of this._banners||[]) {
      ctx.save();
      ctx.translate(b.x, b.y); ctx.rotate(b.angle);
      ctx.fillStyle = b.bg;
      ctx.fillRect(-b.w/2, -b.h/2, b.w, b.h);
      ctx.fillStyle = b.fg;
      ctx.font = `bold ${Math.round(b.h*0.55)}px Arial`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(b.text, 0, 0);
      ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=1;
      ctx.strokeRect(-b.w/2,-b.h/2,b.w,b.h);
      ctx.restore();
    }
    // Checkered start/finish line
    const sf = this.spline[0];
    const sfn = this.normals[0];
    const sq = 14;
    const numSq = Math.ceil(ROAD_WIDTH / sq) + 1;
    const lineAngle = Math.atan2(sfn.ny, sfn.nx);
    ctx.save();
    ctx.translate(sf.x, sf.y);
    ctx.rotate(lineAngle);
    for (let i = 0; i < numSq; i++) {
      for (let row = 0; row < 2; row++) {
        ctx.fillStyle = ((i + row) % 2 === 0) ? '#ffffff' : '#111111';
        ctx.fillRect(-ROAD_WIDTH/2 + i * sq, -sq + row * sq, sq, sq);
      }
    }
    ctx.restore();
    // Trees — more detailed with trunk and highlight
    for (const t of this.trees) {
      // Trunk
      ctx.fillStyle='#5c3d1a';
      ctx.beginPath(); ctx.ellipse(t.x, t.y+t.r*0.4, t.r*0.18, t.r*0.35, 0, 0, PI2); ctx.fill();
      // Outer canopy shadow
      ctx.fillStyle='#1e5012';
      ctx.beginPath(); ctx.arc(t.x+t.r*0.12, t.y+t.r*0.1, t.r, 0, PI2); ctx.fill();
      // Main canopy
      ctx.fillStyle='#2d6e20';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, PI2); ctx.fill();
      // Highlight
      ctx.fillStyle='#4a9a32';
      ctx.beginPath(); ctx.arc(t.x-t.r*0.22, t.y-t.r*0.22, t.r*0.62, 0, PI2); ctx.fill();
      // Top glint
      ctx.fillStyle='rgba(120,220,80,0.3)';
      ctx.beginPath(); ctx.arc(t.x-t.r*0.3, t.y-t.r*0.3, t.r*0.3, 0, PI2); ctx.fill();
    }
    // Grandstands — multi-row with roof and flag
    for (const g of this.grandstands) {
      ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.angle);
      // Stand base
      ctx.fillStyle='#6a6a7a';
      ctx.fillRect(-g.w/2,-g.h/2,g.w,g.h);
      // Row lines
      ctx.strokeStyle='#9090a8'; ctx.lineWidth=1.2;
      const rows = 5;
      for (let r=1;r<rows;r++) {
        const ry = -g.h/2 + r*(g.h/rows);
        ctx.beginPath(); ctx.moveTo(-g.w/2, ry); ctx.lineTo(g.w/2, ry); ctx.stroke();
      }
      // Roof
      ctx.fillStyle='#c0c0d0';
      ctx.fillRect(-g.w/2, -g.h/2-8, g.w, 8);
      // Flag on top
      ctx.fillStyle='#e83030';
      ctx.fillRect(-g.w/2, -g.h/2-22, 12, 10);
      ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=1;
      ctx.strokeRect(-g.w/2,-g.h/2,g.w,g.h);
      ctx.restore();
    }
  }
  drawMinimap(ctx, scale, ox, oy) {
    const SN = this.spline.length;
    ctx.strokeStyle='rgba(100,140,200,0.7)';
    ctx.lineWidth = Math.max(3, ROAD_WIDTH * scale);
    ctx.beginPath();
    const s0 = this.spline[0];
    ctx.moveTo(ox + s0.x*scale, oy + s0.y*scale);
    for (let i=1;i<SN;i++) ctx.lineTo(ox+this.spline[i].x*scale, oy+this.spline[i].y*scale);
    ctx.closePath(); ctx.stroke();
  }
}

// ============================================================
// CAR BASE
// ============================================================
class Car {
  constructor(x, y, heading, color, name) {
    this.x = x; this.y = y;
    this.heading = heading;
    this.color = color;
    this.name = name;
    this.speed = 0;
    this.lateralSpeed = 0;
    this.angularVel = 0;
    this.steerAngle = 0;
    this.wheelbase = 46;
    this.lapCount = 0;
    this.lapProgress = 0;
    this.halfCheck = false;
    this.finished = false;
    this.totalDist = 0;
    this.carConfig = CARS[0];
  }
  updateLap(track, nearest) {
    const res = nearest || track.nearest(this.x, this.y);
    const newProg = res.idx / track.spline.length;
    if (newProg > 0.5) this.halfCheck = true;
    if (this.halfCheck && newProg < 0.1 && this.lapProgress > 0.85) {
      this.lapCount++;
      this.halfCheck = false;
      if (this.lapCount >= TOTAL_LAPS) this.finished = true;
      return true; // lap completed
    }
    this.lapProgress = newProg;
    this.totalDist = this.lapCount * track.totalLen + res.idx;
    return false;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.heading + PI/2);
    // Shadow
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(5, 7, 18, 30, 0, 0, PI2); ctx.fill();
    ctx.globalAlpha = 1;
    // Side panel shadows for depth
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(-19,-29,6,58);
    ctx.fillRect(13,-29,6,58);
    // Car body with gradient for 3D look
    const bodyGrad = ctx.createLinearGradient(-17,0,17,0);
    bodyGrad.addColorStop(0, this._shadeColor(this.color, -35));
    bodyGrad.addColorStop(0.25, this._shadeColor(this.color, 20));
    bodyGrad.addColorStop(0.5, this._shadeColor(this.color, 35));
    bodyGrad.addColorStop(0.75, this._shadeColor(this.color, 20));
    bodyGrad.addColorStop(1, this._shadeColor(this.color, -35));
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(-17,-29,34,58,5);
    ctx.fill();
    // Racing stripe down the center
    const stripeGrad = ctx.createLinearGradient(0,-29,0,29);
    stripeGrad.addColorStop(0,'rgba(255,255,255,0.35)');
    stripeGrad.addColorStop(0.5,'rgba(255,255,255,0.18)');
    stripeGrad.addColorStop(1,'rgba(255,255,255,0.10)');
    ctx.fillStyle = stripeGrad;
    ctx.fillRect(-5,-28,10,56);
    // Rear spoiler
    ctx.fillStyle = this._shadeColor(this.color, -50);
    ctx.fillRect(-18, 26, 36, 5);
    ctx.fillRect(-4, 22, 8, 9);
    // Windshield with gradient (reflective look)
    const wGrad = ctx.createLinearGradient(-12,-20,12,-6);
    wGrad.addColorStop(0,'rgba(160,220,255,0.85)');
    wGrad.addColorStop(0.4,'rgba(120,200,255,0.55)');
    wGrad.addColorStop(1,'rgba(80,160,220,0.3)');
    ctx.fillStyle = wGrad;
    ctx.beginPath(); ctx.roundRect(-11,-20,22,14,2); ctx.fill();
    // Windshield glare
    ctx.fillStyle='rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.roundRect(-9,-19,8,5,1); ctx.fill();
    // Rear window
    const rwGrad = ctx.createLinearGradient(-10,8,10,18);
    rwGrad.addColorStop(0,'rgba(80,160,220,0.4)');
    rwGrad.addColorStop(1,'rgba(60,130,190,0.25)');
    ctx.fillStyle = rwGrad;
    ctx.beginPath(); ctx.roundRect(-10,8,20,10,2); ctx.fill();
    // Wheels — front wheels show steer angle, all with rim highlights
    const wheelDefs = [
      {cx:-18.5, cy:-20, front:true},
      {cx: 11.5, cy:-20, front:true},
      {cx:-18.5, cy: 12, front:false},
      {cx: 11.5, cy: 12, front:false}
    ];
    for (const wd of wheelDefs) {
      ctx.save();
      ctx.translate(wd.cx + 3.5, wd.cy + 8);
      if (wd.front) ctx.rotate(this.steerAngle * 0.65);
      ctx.fillStyle='#1a1a1a';
      ctx.beginPath(); ctx.roundRect(-3.5,-8,7,16,2); ctx.fill();
      ctx.fillStyle='rgba(200,200,200,0.55)';
      ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, PI2); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.arc(0, 0, 1.2, 0, PI2); ctx.fill();
      ctx.restore();
    }
    // Headlights at front — glow effect
    ctx.shadowColor='rgba(255,255,200,0.9)';
    ctx.shadowBlur=8;
    ctx.fillStyle='rgba(255,255,190,0.95)';
    ctx.beginPath(); ctx.arc(-9,-26,4,0,PI2); ctx.fill();
    ctx.beginPath(); ctx.arc(9,-26,4,0,PI2); ctx.fill();
    ctx.shadowBlur=0;
    // Tail lights at rear — red glow
    ctx.shadowColor='rgba(220,20,20,0.8)';
    ctx.shadowBlur=6;
    ctx.fillStyle='#ee1111';
    ctx.beginPath(); ctx.roundRect(-13,24,9,5,1); ctx.fill();
    ctx.beginPath(); ctx.roundRect(4,24,9,5,1); ctx.fill();
    ctx.shadowBlur=0;
    ctx.restore();
    // Name tag
    ctx.fillStyle='rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.roundRect(this.x-22,this.y-44,44,14,3); ctx.fill();
    ctx.fillStyle='#fff';
    ctx.font='bold 9px Arial';
    ctx.textAlign='center';
    ctx.fillText(this.name, this.x, this.y-33);
  }
  _shadeColor(hex, amount) {
    // Lighten/darken a hex color by amount (-255 to 255). Supports #rrggbb and rgb()/rgba().
    let r=0,g=0,b=0;
    if (typeof hex === 'string' && hex.charAt(0) === '#' && hex.length === 7) {
      r=parseInt(hex.slice(1,3),16); g=parseInt(hex.slice(3,5),16); b=parseInt(hex.slice(5,7),16);
    } else if (typeof hex === 'string' && (hex.startsWith('rgb'))) {
      const m=hex.match(/[\d.]+/g);
      if(m && m.length >= 3){r=+m[0];g=+m[1];b=+m[2];}
      else { return hex; }
    } else { return hex; }
    r=clamp(r+amount,0,255); g=clamp(g+amount,0,255); b=clamp(b+amount,0,255);
    return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
  }
}

// ============================================================
// PLAYER
// ============================================================
class Player extends Car {
  constructor(x, y, heading, color, name, carConfig) {
    super(x,y,heading,color,name);
    this.carConfig = carConfig;
    this.hp = 100; this.fuel = 100; this.nitro = 0; this.tires = 100;
    this.score = 0; this.driftScore = 0;
    this.rpm = 800; this.gear = 1;
    this.inventory = [null,null,null];
    this.activeEffects = {};
    this.exhaustTimer = 0;
    this.lapTimes = [];
    this.lapStart = 0;
    this.bestLap = null;
    this.lastLapTime = null;
    this.drifting = false;
    this.nitroTimer = 0;
    this._nitroOn = false;
  }
  addItem(type) {
    for (let i=0;i<3;i++) { if (!this.inventory[i]) { this.inventory[i]=type; return; } }
  }
  useItem(oilSlicks, missiles, particles, audio, allCars) {
    if (!this.inventory[0]) return;
    const type = this.inventory[0];
    this.inventory.shift(); this.inventory.push(null);
    if (audio) audio.playEffect('powerup');
    switch(type) {
      case 'shield': this.activeEffects.shield = 5000; break;
      case 'boost':  this.activeEffects.boost = 3000; break;
      case 'missile':
        if (missiles) {
          let target = null, best = Infinity;
          for (const c of allCars) {
            const d2 = dist(this.x,this.y,c.x,c.y);
            if (d2 < best && d2 > 10) { best=d2; target=c; }
          }
          const h = target ? Math.atan2(target.y-this.y,target.x-this.x) : this.heading;
          const m = new Missile(this.x,this.y,h,particles);
          m.owner = this;
          missiles.push(m);
          if (audio) audio.playEffect('missile');
        }
        break;
      case 'oil': if (oilSlicks) oilSlicks.push(new OilSlick(this.x,this.y)); break;
      case 'magnet': this.activeEffects.magnet = 4000; break;
      case 'repair': this.hp = Math.min(100, this.hp+40); break;
      case 'nitro_refill': this.nitro = this.carConfig.nitroMax; break;
      case 'mine': if (oilSlicks) oilSlicks.push(new OilSlick(this.x+rng(-20,20),this.y+rng(-20,20))); break;
      case 'lightning': for (const c of allCars) { c.speed*=0.2; c.angularVel+=(Math.random()-0.5)*1; } if (audio) audio.playEffect('thunder'); break;
      case 'ghost_mode': this.activeEffects.ghost_mode = 4000; break;
    }
  }
  draw(ctx) {
    // Boost / nitro flame behind car
    if (this.activeEffects.boost || this._nitroOn) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.heading + PI/2);
      const flameLen = this.activeEffects.boost ? 45 + rng(0,12) : 30 + rng(0,8);
      const grd = ctx.createLinearGradient(0, 30, 0, 30 + flameLen);
      if (this._nitroOn && !this.activeEffects.boost) {
        grd.addColorStop(0, 'rgba(80,180,255,0.95)');
        grd.addColorStop(0.5,'rgba(0,120,255,0.6)');
        grd.addColorStop(1, 'rgba(0,60,200,0)');
      } else {
        grd.addColorStop(0, 'rgba(255,180,0,0.95)');
        grd.addColorStop(0.5,'rgba(255,60,0,0.65)');
        grd.addColorStop(1, 'rgba(200,0,0,0)');
      }
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(-9, 30); ctx.lineTo(9, 30); ctx.lineTo(0, 30 + flameLen);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // Ghost mode – draw semi-transparent
    if (this.activeEffects.ghost_mode) {
      ctx.save(); ctx.globalAlpha = 0.42;
      super.draw(ctx);
      ctx.restore();
      return;
    }
    // Normal draw
    super.draw(ctx);
    // Shield bubble
    if (this.activeEffects.shield) {
      const prog = clamp(this.activeEffects.shield / 5000, 0, 1);
      ctx.save();
      ctx.globalAlpha = 0.12 + prog * 0.18;
      ctx.fillStyle = '#60aaff';
      ctx.beginPath(); ctx.arc(this.x, this.y, 40, 0, PI2); ctx.fill();
      ctx.globalAlpha = 0.45 + prog * 0.25;
      ctx.strokeStyle = '#80ccff';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(this.x, this.y, 40, 0, PI2); ctx.stroke();
      ctx.restore();
    }
  }
  update(dt, input, track, weather, itemBoxes, oilSlicks, missiles, particles, audio, ghost, allCars) {
    const cfg = this.carConfig;
    const grip = weather.getGrip() * (this.tires/100*0.4+0.6);
    // Update effects
    for (const k of Object.keys(this.activeEffects)) {
      this.activeEffects[k] -= dt;
      if (this.activeEffects[k] <= 0) delete this.activeEffects[k];
    }
    // Steering
    const steerRate = 3.6 * dt * 0.001;
    if (input.steer !== 0) {
      this.steerAngle = clamp(this.steerAngle + input.steer * steerRate, -0.7, 0.7);
    } else {
      this.steerAngle = damp(this.steerAngle, 0, 12, dt * 0.001);
    }
    // Gas / Brake
    const boostMul = this.activeEffects.boost ? rng(1.45,1.50) : 1.0;
    if (input.gas) this.speed += cfg.accel * boostMul * (dt*0.004);
    else this.speed *= Math.pow(0.4, dt * 0.001);
    if (input.brake) this.speed -= cfg.brake * (dt*0.004);
    this.speed = clamp(this.speed, -15, cfg.topSpeed * boostMul);
    // Nitro
    if (input.nitro && this.nitro > 0) {
      this.speed += 0.4 * (dt*0.004);
      this.nitro -= 18 * dt * 0.001;
      this.nitroTimer += dt;
      this._nitroOn = true;
      // Blue/cyan nitro flame particles
      if (particles && Math.random() > 0.35) {
        const ex = this.x - Math.cos(this.heading)*32, ey = this.y - Math.sin(this.heading)*32;
        particles.emit(ex, ey, {
          color: Math.random() > 0.5 ? '#40aaff' : '#00ddff',
          size: rng(3,7), life: 240,
          vx: rng(-40,40), vy: rng(-40,40), drag: 0.88
        });
      }
    } else {
      this.nitro = Math.min(cfg.nitroMax, this.nitro + 6 * dt * 0.001);
      this._nitroOn = false;
    }
    this.nitro = clamp(this.nitro,0,cfg.nitroMax);
    // Handbrake
    if (input.handbrake) this.lateralSpeed *= 0.88;
    // Angular velocity
    if (Math.abs(this.speed) > 0.5) {
      const turnRate = (this.speed / this.wheelbase) * Math.tan(this.steerAngle) * grip;
      this.angularVel = damp(this.angularVel, turnRate, 8, dt * 0.001);
    } else {
      this.angularVel *= 0.7;
    }
    this.heading += this.angularVel * dt * 0.001 * 30;
    this.angularVel = damp(this.angularVel, 0, 5, dt * 0.001);
    this.angularVel = clamp(this.angularVel, -3, 3);
    // Lateral speed (drift)
    const latFriction = Math.pow(input.handbrake ? 0.003 : 0.15, dt * 0.001);
    this.lateralSpeed *= latFriction;
    if (Math.abs(this.speed) > 1) {
      const sideForce = this.angularVel * this.speed * 0.06 * (1-grip);
      this.lateralSpeed += sideForce;
    }
    // Move
    this.x += (Math.cos(this.heading)*this.speed - Math.sin(this.heading)*this.lateralSpeed) * dt*0.001*60;
    this.y += (Math.sin(this.heading)*this.speed + Math.cos(this.heading)*this.lateralSpeed) * dt*0.001*60;
    // Hard wall collision at track boundary
    const nearest = track.nearest(this.x, this.y);
    const wallDist = ROAD_WIDTH / 2;
    if (nearest.dist > wallDist) {
      const sp = track.spline[nearest.idx];
      const dx = this.x - sp.x, dy = this.y - sp.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0.1) {
        // Outward normal (from track center toward car)
        const nx = dx / d, ny = dy / d;
        // Soft push-back: cap snap per frame to avoid teleporting
        const over = nearest.dist - wallDist;
        const snap = Math.min(over, 15);
        this.x -= nx * snap;
        this.y -= ny * snap;
        // World-space velocity
        const vx = Math.cos(this.heading) * this.speed - Math.sin(this.heading) * this.lateralSpeed;
        const vy = Math.sin(this.heading) * this.speed + Math.cos(this.heading) * this.lateralSpeed;
        // Reflect outward velocity component with restitution
        const dot = vx * nx + vy * ny;
        if (dot > 0) {
          const rvx = vx - (1 + PLAYER_WALL_RESTITUTION) * dot * nx;
          const rvy = vy - (1 + PLAYER_WALL_RESTITUTION) * dot * ny;
          this.speed = (Math.cos(this.heading) * rvx + Math.sin(this.heading) * rvy) * PLAYER_WALL_SPEED_FACTOR;
          this.lateralSpeed = (-Math.sin(this.heading) * rvx + Math.cos(this.heading) * rvy) * PLAYER_WALL_SPEED_FACTOR;
          // Effects with cooldown to avoid triggering every frame
          const now = Date.now();
          if (!this.wallHitTime || now - this.wallHitTime > WALL_HIT_COOLDOWN_MS) {
            this.wallHitTime = now;
            this.hp -= 3;
            this.angularVel += (Math.random() - 0.5) * 0.8;
            if (particles) particles.burst(this.x, this.y, 10, {color:'#ffdd44', minSpd:60, maxSpd:180, life:400, size:3});
            if (audio) audio.playEffect('impact');
            this.pendingShake = (this.pendingShake || 0) + 10;
          }
        }
      }
    }
    // Oil slick
    if (oilSlicks) {
      for (const o of oilSlicks) {
        if (o.active && dist(this.x,this.y,o.x,o.y) < 50) {
          this.lateralSpeed += rng(-30,30);
          this.steerAngle *= 1.3;
        }
      }
    }
    // Item pickup
    if (itemBoxes) {
      const pickupR = this.activeEffects.magnet ? 180 : 50;
      for (const ib of itemBoxes) {
        if (ib.active && dist(this.x,this.y,ib.x,ib.y) < pickupR) {
          if (ib.collect(this)) { if (audio) audio.playEffect('pickup'); }
        }
      }
    }
    // Drift detection
    const abslat = Math.abs(this.lateralSpeed);
    if (abslat > 25 && Math.abs(this.speed) > 30) {
      this.drifting = true;
      const ds = abslat * dt * 0.001;
      this.score += ds * 2;
      this.driftScore += ds * 2;
      if (particles) particles.emit(this.x,this.y,{color:'rgba(180,180,180,0.7)',size:8,life:600,vx:rng(-30,30),vy:rng(-30,30),drag:0.92});
    } else { this.drifting = false; }
    // Exhaust smoke
    this.exhaustTimer += dt;
    if (this.exhaustTimer > 80 && input.gas && particles) {
      this.exhaustTimer = 0;
      const ex = this.x - Math.cos(this.heading)*32, ey = this.y - Math.sin(this.heading)*32;
      particles.emit(ex,ey,{color:'rgba(100,100,100,0.4)',size:5,life:400,vx:rng(-15,15),vy:rng(-15,15),drag:0.94});
    }
    // RPM and gear
    const speedRatio = Math.abs(this.speed)/cfg.topSpeed;
    this.rpm = clamp(speedRatio*7000+800, 800, 8000);
    this.gear = Math.max(1, Math.min(6, Math.ceil(speedRatio*6)));
    if (Math.abs(this.speed) < 5) this.gear = 0;
    // Engine audio
    if (audio) audio.setEngine(this.rpm, this.speed);
    // Ghost recording
    if (ghost) ghost.record(this.x, this.y, this.heading);
    // Tires/fuel degrade
    this.tires -= 0.01 * dt*0.001;
    this.fuel  -= 0.04 * dt*0.001;
    this.tires = clamp(this.tires,0,100);
    this.fuel  = clamp(this.fuel,0,100);
    this.hp    = clamp(this.hp,0,100);
    // Lap
    const lapDone = this.updateLap(track, nearest);
    if (lapDone && this.lapCount > 1) {
      const lt = Date.now() - this.lapStart;
      this.lapTimes.push(lt);
      this.lastLapTime = lt;
      if (!this.bestLap || lt < this.bestLap) this.bestLap = lt;
      if (ghost) ghost.saveLap(lt);
      this.lapStart = Date.now();
    }
    if (this.lapCount === 0 && this.lapProgress < 0.05) this.lapStart = Date.now();
  }
}

// ============================================================
// AI
// ============================================================
class AI extends Car {
  constructor(x, y, heading, color, name, carConfig, skill) {
    super(x,y,heading,color,name);
    this.carConfig = carConfig;
    this.skill = skill;
    this.waypointIdx = 0;
    this.lookahead = Math.round(lerp(8, 18, skill));
    this.inventory = [null,null,null];
    this.hp = 100;
    this.stunTimer = 0;
    this.activeEffects = { shield: 0, ghost_mode: 0, boost: 0, magnet: 0 };
    // Personality traits
    const p = AI_PERSONALITIES[name] || { aggression: 0.65, caution: 0.65, itemStrategy: 0.70, consistency: 0.80 };
    this.aggression   = p.aggression;
    this.caution      = p.caution;
    this.itemStrategy = p.itemStrategy;
    this.consistency  = p.consistency;
    // Internal state
    this._recoveryTimer      = 0;
    this._overtakeTimer      = 0;
    this._overtakeSide       = 0;
    this._targetRacingOffset = 0;
  }

  addItem(type) {
    for (let i=0;i<3;i++) { if (!this.inventory[i]) { this.inventory[i]=type; return; } }
  }

  _getRacePosition(allCars) {
    let pos = 0;
    for (const c of allCars) { if (c !== this && c.totalDist > this.totalDist) pos++; }
    return pos;
  }

  _applyItem(type, allCars, oilSlicks, missiles, particles) {
    switch (type) {
      case 'boost':
        this.speed = Math.min(this.speed * 1.40, this.carConfig.topSpeed);
        this.activeEffects.boost = 3000;
        break;
      case 'nitro_refill':
        this.speed = Math.min(this.speed * 1.35, this.carConfig.topSpeed);
        break;
      case 'repair':
        this.hp = Math.min(100, this.hp + 40);
        break;
      case 'shield':
        this.activeEffects.shield = 5000;
        break;
      case 'ghost_mode':
        this.activeEffects.ghost_mode = 4000;
        break;
      case 'magnet':
        this.activeEffects.magnet = 4000;
        break;
      case 'missile':
        if (missiles && particles) {
          // Target the nearest car ahead of us
          let bestTarget = null, bestDist = 400;
          for (const c of allCars) {
            if (c === this) continue;
            const d = dist(this.x, this.y, c.x, c.y);
            if (d < bestDist && c.totalDist > this.totalDist) {
              const aToT = Math.atan2(c.y - this.y, c.x - this.x);
              if (Math.abs(angleDiff(this.heading, aToT)) < PI * 0.6) {
                bestTarget = c; bestDist = d;
              }
            }
          }
          const mHeading = bestTarget
            ? Math.atan2(bestTarget.y - this.y, bestTarget.x - this.x)
            : this.heading;
          const m = new Missile(this.x, this.y, mHeading, particles);
          m.owner = this;
          missiles.push(m);
        }
        break;
      case 'oil':
        if (oilSlicks) oilSlicks.push(new OilSlick(this.x, this.y));
        break;
      case 'mine':
        if (oilSlicks) oilSlicks.push(new OilSlick(this.x + rng(-20,20), this.y + rng(-20,20)));
        break;
      case 'lightning':
        for (const c of allCars) {
          if (c !== this) { c.speed *= 0.2; c.angularVel += (Math.random()-0.5)*1; }
        }
        break;
    }
  }

  _useItemStrategic(allCars, oilSlicks, missiles, particles, track, targetIdx) {
    if (!this.inventory[0]) return;
    const type = this.inventory[0];
    const myPos = this._getRacePosition(allCars);
    const numCars = allCars.length;
    const SN = track.spline.length;
    let shouldUse = false;

    switch (type) {
      case 'repair':
        shouldUse = this.hp < 50;
        break;
      case 'shield': {
        // Use when a missile is incoming
        if (missiles) {
          for (const m of missiles) {
            if (m.owner !== this && dist(this.x, this.y, m.x, m.y) < 200) { shouldUse = true; break; }
          }
        }
        // Or when surrounded by 2+ close cars
        if (!shouldUse) {
          let n = 0;
          for (const c of allCars) { if (c !== this && dist(this.x, this.y, c.x, c.y) < 100) n++; }
          if (n >= 2) shouldUse = true;
        }
        break;
      }
      case 'boost':
      case 'nitro_refill': {
        // Use on clear straights
        let straightness = 0;
        for (let i = 0; i < 10; i++) straightness += track.curvatureAt((targetIdx + i * 2) % SN);
        straightness /= 10; // 1 = straight, 0 = sharp
        shouldUse = straightness > lerp(0.80, 0.65, this.aggression);
        break;
      }
      case 'missile': {
        if (missiles && particles) {
          for (const c of allCars) {
            if (c === this) continue;
            const d = dist(this.x, this.y, c.x, c.y);
            if (d < 300 && c.totalDist > this.totalDist) {
              const aToT = Math.atan2(c.y - this.y, c.x - this.x);
              if (Math.abs(angleDiff(this.heading, aToT)) < PI / 2.5) { shouldUse = true; break; }
            }
          }
        }
        break;
      }
      case 'oil':
      case 'mine': {
        // Drop behind when being closely followed
        for (const c of allCars) {
          if (c === this) continue;
          const d = dist(this.x, this.y, c.x, c.y);
          if (d < 130 && c.totalDist < this.totalDist) {
            const angBehind = Math.atan2(c.y - this.y, c.x - this.x);
            if (Math.abs(angleDiff(this.heading + PI, angBehind)) < PI / 3) { shouldUse = true; break; }
          }
        }
        break;
      }
      case 'lightning':
        shouldUse = myPos >= numCars - 2;
        break;
      case 'ghost_mode': {
        let n = 0;
        for (const c of allCars) { if (c !== this && dist(this.x, this.y, c.x, c.y) < 120) n++; }
        shouldUse = n >= 2;
        break;
      }
      case 'magnet':
        shouldUse = true; // always useful for item collection
        break;
    }

    if (shouldUse && Math.random() < this.itemStrategy) {
      const usedType = this.inventory[0];
      this.inventory.shift();
      this.inventory.push(null);
      this._applyItem(usedType, allCars, oilSlicks, missiles, particles);
    }
  }

  update(dt, track, playerX, playerY, allCars, itemBoxes, oilSlicks, weather, missiles, particles) {
    // Update active effect timers
    for (const k in this.activeEffects) { if (this.activeEffects[k] > 0) this.activeEffects[k] -= dt; }

    // --- Stun: slow down and skip AI logic ---
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.speed *= 0.95;
      if (this.stunTimer <= 0) this._recoveryTimer = 1500; // gradual rebuild after stun
      return;
    }

    const SN = track.spline.length;
    const nearest = track.nearest(this.x, this.y);
    this.waypointIdx = nearest.idx;

    // === 1. MULTI-POINT LOOKAHEAD PATH PLANNING ===
    // Gauge upcoming curve tightness to adapt lookahead distance
    let upcomingCurv = 0;
    for (let i = 1; i <= 8; i++) {
      upcomingCurv = Math.max(upcomingCurv, 1 - track.curvatureAt((this.waypointIdx + i * 2) % SN));
    }
    const baseLookahead = Math.round(lerp(8, 18, this.skill));
    // Longer lookahead on straights, shorter through tight sections
    const adaptiveLookahead = Math.round(lerp(baseLookahead * 1.5, baseLookahead * 0.6, upcomingCurv));
    const targetIdx = (this.waypointIdx + adaptiveLookahead) % SN;

    // Weighted average of multiple lookahead points for smoother steering
    let tX = 0, tY = 0, wSum = 0;
    for (let i = 1; i <= 4; i++) {
      const idx = (this.waypointIdx + Math.round(adaptiveLookahead * i / 4)) % SN;
      const w = i;
      tX += track.spline[idx].x * w;
      tY += track.spline[idx].y * w;
      wSum += w;
    }
    tX /= wSum;
    tY /= wSum;

    // === 10. RACING LINE OPTIMIZATION ===
    // Offset the target toward the inside of upcoming curves
    const turnTightness = 1 - track.curvatureAt(targetIdx); // 0=straight, 1=sharp
    if (turnTightness > 0.05) {
      const normal = track.normals[targetIdx];
      const pA = track.spline[(targetIdx - 4 + SN) % SN];
      const pB = track.spline[targetIdx];
      const pC = track.spline[(targetIdx + 4) % SN];
      const t1x = pB.x - pA.x, t1y = pB.y - pA.y;
      const t2x = pC.x - pB.x, t2y = pC.y - pB.y;
      // Z-component of cross product: positive = left turn, negative = right turn
      const cross = t1x * t2y - t1y * t2x;
      const insideSide = cross > 0 ? 1 : -1;
      const racingOffset = turnTightness * ROAD_WIDTH * 0.22 * insideSide * this.skill;
      this._targetRacingOffset = damp(this._targetRacingOffset, racingOffset, 3, dt * 0.001);
      tX += normal.nx * this._targetRacingOffset;
      tY += normal.ny * this._targetRacingOffset;
    } else {
      this._targetRacingOffset = damp(this._targetRacingOffset, 0, 3, dt * 0.001);
    }

    // Steer toward computed target — use damped steering for smoother response
    const desiredH = Math.atan2(tY - this.y, tX - this.x);
    const diff = angleDiff(this.heading, desiredH);
    const targetSteer = clamp(diff * lerp(1.0, 1.4, this.skill), -0.6, 0.6);
    this.steerAngle = damp(this.steerAngle, targetSteer, lerp(6, 9, this.skill), dt * 0.001);

    // === 2. PREDICTIVE BRAKING ===
    // Look ahead at upcoming curvature and begin braking before tight turns
    let maxFutureTightness = 0;
    const brakeSteps = Math.round(lerp(8, 22, this.skill));
    for (let i = 2; i <= brakeSteps; i++) {
      const t = (1 - track.curvatureAt((this.waypointIdx + i) % SN)) * (1 - (i - 2) / brakeSteps);
      if (t > maxFutureTightness) maxFutureTightness = t;
    }
    const immediateTightness = 1 - track.curvatureAt(targetIdx);
    const brakeStrength = Math.max(immediateTightness, maxFutureTightness * 0.85);

    // === 7. WEATHER-AWARE GRIP ===
    const weatherGrip = weather ? weather.getGrip() : 1.0;
    const weatherSpeedScale = lerp(0.80, 1.0, weatherGrip);

    // === 4. DRAFTING / SLIPSTREAM ===
    let draftBonus = 0;
    for (const c of allCars) {
      if (c === this) continue;
      const d = dist(this.x, this.y, c.x, c.y);
      if (d < 120 && d > 20) {
        const aToC = Math.atan2(c.y - this.y, c.x - this.x);
        if (Math.abs(angleDiff(this.heading, aToC)) < 0.3 && c.totalDist > this.totalDist) {
          draftBonus = Math.max(draftBonus, lerp(0, 0.08, 1 - d / 120));
        }
      }
    }

    // Target speed: factor in caution, curvature, weather, and drafting
    const cautionScale = lerp(1.0, lerp(0.72, 0.55, this.caution), brakeStrength);
    const maxSpd = this.carConfig.topSpeed * this.skill * cautionScale * weatherSpeedScale * (1 + draftBonus);

    // Acceleration / braking
    if (this.speed < maxSpd) {
      const recovMult = this._recoveryTimer > 0 ? lerp(0.3, 1.0, 1 - this._recoveryTimer / 1500) : 1.0;
      this.speed += this.carConfig.accel * this.skill * dt * 0.004 * recovMult;
    } else if (brakeStrength > 0.25) {
      this.speed *= lerp(0.993, 0.965, brakeStrength);
    } else {
      this.speed *= 0.993;
    }
    if (this._recoveryTimer > 0) this._recoveryTimer -= dt;
    this.speed = clamp(this.speed, 0, this.carConfig.topSpeed);

    // === 11. IMPROVED CAR-TO-CAR AVOIDANCE ===
    for (const c of allCars) {
      if (c === this) continue;
      const d2 = dist(this.x, this.y, c.x, c.y);
      if (d2 < 90 && d2 > 0.1) {
        const aToC = Math.atan2(c.y - this.y, c.x - this.x);
        const hDiff = angleDiff(this.heading, aToC);
        // Allow side-by-side racing: skip avoidance when car is beside us at similar speed
        const isBeside = Math.abs(hDiff) > 0.8 && Math.abs(hDiff) < 2.3;
        if (!isBeside) {
          // Steer away via steerAngle (physics-consistent, avoids jerky heading jumps)
          const avoidDir = angleDiff(this.heading, aToC + PI);
          this.steerAngle = clamp(this.steerAngle + avoidDir * ((90 - d2) / 90) * 0.22, -0.6, 0.6);
          // Brake when approaching a slower car from behind
          if (Math.abs(hDiff) < 0.4 && this.speed > c.speed + 15) {
            this.speed = damp(this.speed, c.speed + 10, 3, dt * 0.001);
          }
        }
      }
    }

    // === 5. AGGRESSIVE OVERTAKING ===
    if (this._overtakeTimer <= 0) {
      for (const c of allCars) {
        if (c === this) continue;
        const d = dist(this.x, this.y, c.x, c.y);
        if (d < 110 && d > 30) {
          const aToC = Math.atan2(c.y - this.y, c.x - this.x);
          const hDiff = angleDiff(this.heading, aToC);
          if (Math.abs(hDiff) < 0.45 && c.totalDist > this.totalDist && c.speed <= this.speed * 1.1) {
            if (Math.random() < this.aggression * 0.008 * dt) {
              this._overtakeTimer = 1200;
              this._overtakeSide = hDiff >= 0 ? -1 : 1;
            }
          }
        }
      }
    } else {
      this._overtakeTimer -= dt;
      this.steerAngle = clamp(this.steerAngle + this._overtakeSide * 0.18 * this.aggression, -0.6, 0.6);
    }

    // === 6. DEFENSIVE DRIVING ===
    // When leading or in 2nd, subtly block the racing line
    if (this._getRacePosition(allCars) <= 1 && this._overtakeTimer <= 0) {
      for (const c of allCars) {
        if (c === this) continue;
        const d = dist(this.x, this.y, c.x, c.y);
        if (d < 130) {
          const aToC = Math.atan2(c.y - this.y, c.x - this.x);
          const hDiff = angleDiff(this.heading, aToC + PI);
          if (Math.abs(hDiff) < 0.55 && c.totalDist < this.totalDist) {
            this.steerAngle = clamp(this.steerAngle - hDiff * 0.12 * this.aggression, -0.6, 0.6);
          }
        }
      }
    }

    // === OIL SLICK AVOIDANCE (improved: earlier detection, caution-scaled) ===
    if (oilSlicks) {
      for (const o of oilSlicks) {
        if (!o.active) continue;
        const od = dist(this.x, this.y, o.x, o.y);
        const avoidR = lerp(90, 145, this.caution);
        if (od < avoidR) {
          const avoidA = Math.atan2(this.y - o.y, this.x - o.x);
          const str = lerp(0.25, 0.55, this.caution) * (1 - od / avoidR);
          this.steerAngle = clamp(this.steerAngle + angleDiff(this.heading, avoidA) * str, -0.6, 0.6);
          if (od < 60) this.speed *= lerp(0.999, 0.996, this.caution);
        }
      }
    }

    // Hard wall collision for AI
    if (nearest.dist > ROAD_WIDTH / 2) {
      const sp = track.spline[nearest.idx];
      const dx = this.x - sp.x, dy = this.y - sp.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0.1) {
        const nx = dx / d, ny = dy / d;
        const over = nearest.dist - ROAD_WIDTH / 2;
        const snap = Math.min(over, 15);
        this.x -= nx * snap;
        this.y -= ny * snap;
        const vx = Math.cos(this.heading) * this.speed - Math.sin(this.heading) * this.lateralSpeed;
        const vy = Math.sin(this.heading) * this.speed + Math.cos(this.heading) * this.lateralSpeed;
        const dot = vx * nx + vy * ny;
        if (dot > 0) {
          const rvx = vx - (1 + AI_WALL_RESTITUTION) * dot * nx;
          const rvy = vy - (1 + AI_WALL_RESTITUTION) * dot * ny;
          this.speed = (Math.cos(this.heading) * rvx + Math.sin(this.heading) * rvy) * AI_WALL_SPEED_FACTOR;
          this.lateralSpeed = (-Math.sin(this.heading) * rvx + Math.cos(this.heading) * rvy) * AI_WALL_SPEED_FACTOR;
          // === 9. RECOVERY after wall hit: gradual speed rebuild ===
          this._recoveryTimer = 1000;
        }
      }
    }

    // Item pickup (extend range when magnet is active)
    if (itemBoxes) {
      const pickupR = this.activeEffects.magnet > 0 ? 180 : 40;
      for (const ib of itemBoxes) {
        if (ib.active && dist(this.x, this.y, ib.x, ib.y) < pickupR) ib.collect(this);
      }
    }

    // === 3. STRATEGIC ITEM USAGE ===
    this._useItemStrategic(allCars, oilSlicks, missiles, particles, track, targetIdx);

    // === 9. SPIN RECOVERY: reduce steering input when spinning ===
    if (Math.abs(this.angularVel) > 1.5) {
      this.steerAngle *= 0.15;
      this.speed *= 0.97;
    }

    // === 8. PERSONALITY CONSISTENCY: add subtle noise for erratic AIs ===
    if (this.consistency < 0.95) {
      this.steerAngle += (Math.random() - 0.5) * lerp(0.06, 0, this.consistency);
    }

    // Physics — damp angularVel like player for smoother turning
    const grip = weatherGrip * AI_BASE_GRIP_MULTIPLIER;
    if (Math.abs(this.speed) > 0.5) {
      const targetAngVel = (this.speed/this.wheelbase)*Math.tan(this.steerAngle)*grip;
      this.angularVel = damp(this.angularVel, targetAngVel, 8, dt * 0.001);
    }
    this.heading += this.angularVel * dt*0.001*30;
    this.angularVel = damp(this.angularVel, 0, 5, dt * 0.001);
    this.angularVel = clamp(this.angularVel, -3, 3);
    this.lateralSpeed *= Math.pow(0.15, dt * 0.001);
    this.x += (Math.cos(this.heading)*this.speed - Math.sin(this.heading)*this.lateralSpeed)*dt*0.001*60;
    this.y += (Math.sin(this.heading)*this.speed + Math.cos(this.heading)*this.lateralSpeed)*dt*0.001*60;
    // Exhaust smoke (emit from rear of car)
    if (particles && this.speed > 5 && Math.random() > 0.65) {
      const ex = this.x - Math.cos(this.heading)*30, ey = this.y - Math.sin(this.heading)*30;
      particles.emit(ex, ey, {color:'rgba(120,120,120,0.35)',size:4,life:320,vx:rng(-12,12),vy:rng(-12,12),drag:0.94});
    }
    this.updateLap(track, nearest);
  }
}

// ============================================================
// TACHOMETER
// ============================================================
function drawTachometer(ctx, rpm, maxRpm, gear, speed) {
  const W = 135, CX = W/2, CY = W/2, R = 54;
  ctx.clearRect(0,0,W,W);
  // Background
  ctx.fillStyle='rgba(8,10,18,0.85)';
  ctx.beginPath(); ctx.arc(CX,CY,R+8,0,PI2); ctx.fill();
  // Color arcs
  const startA = 0.75*PI, endA = 2.25*PI, sweep = endA-startA;
  const rpmRatio = clamp(rpm/maxRpm,0,1);
  const zones = [[0,0.6,'#20c040'],[0.6,0.8,'#f0c030'],[0.8,1.0,'#e83030']];
  for (const [lo,hi,col] of zones) {
    ctx.strokeStyle=col; ctx.lineWidth=6;
    ctx.beginPath();
    ctx.arc(CX,CY,R,startA+sweep*lo,startA+sweep*Math.min(hi,rpmRatio));
    ctx.stroke();
  }
  // Tick marks
  for (let i=0;i<=8;i++) {
    const a = startA + sweep*(i/8);
    const inner = R-10, outer = R+2;
    ctx.strokeStyle='#aaa'; ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(CX+Math.cos(a)*inner,CY+Math.sin(a)*inner);
    ctx.lineTo(CX+Math.cos(a)*outer,CY+Math.sin(a)*outer);
    ctx.stroke();
  }
  // Needle
  const needleA = startA + sweep*rpmRatio;
  ctx.strokeStyle='#ff2222'; ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(CX,CY);
  ctx.lineTo(CX+Math.cos(needleA)*(R-4),CY+Math.sin(needleA)*(R-4));
  ctx.stroke();
  // Center cap
  ctx.fillStyle='#333';
  ctx.beginPath(); ctx.arc(CX,CY,6,0,PI2); ctx.fill();
  // Gear & speed text
  ctx.fillStyle='#fff'; ctx.font='bold 16px Arial'; ctx.textAlign='center';
  ctx.fillText(gear || 'N', CX, CY+6);
  ctx.font='10px Arial'; ctx.fillStyle='#aaa';
  ctx.fillText(Math.round(speed)+'km/h', CX, CY+22);
}

// ============================================================
// SPEED LINES
// ============================================================
function drawSpeedLines(ctx, W, H, speedRatio) {
  if (speedRatio < 0.7) return;
  const alpha = (speedRatio-0.7)/0.3;
  const cx = W/2, cy = H/2;
  const count = 14;
  ctx.save();
  ctx.strokeStyle=`rgba(255,255,255,${alpha*0.35})`;
  ctx.lineWidth=1.5;
  for (let i=0;i<count;i++) {
    const a = (i/count)*PI2 + Date.now()*0.0003;
    ctx.beginPath();
    ctx.moveTo(cx+Math.cos(a)*30, cy+Math.sin(a)*30);
    ctx.lineTo(cx+Math.cos(a)*160, cy+Math.sin(a)*160);
    ctx.stroke();
  }
  ctx.restore();
}

// ============================================================
// NOTIFICATIONS
// ============================================================
class Notifications {
  constructor() { this.items = []; }
  add(text, color='#fff', duration=2000) {
    this.items.push({text, color, life:duration, maxLife:duration, scale:0, y:0});
  }
  update(dt) {
    for (let i=this.items.length-1;i>=0;i--) {
      const n = this.items[i];
      n.life -= dt;
      if (n.life <= 0) { this.items.splice(i,1); continue; }
      const t = n.life/n.maxLife;
      n.scale = t < 0.9 ? (t > 0.1 ? 1 : t/0.1) : (1-t)/0.1;
      n.scale = clamp(n.scale,0,1);
    }
  }
  draw(ctx, W, H) {
    const cx = W/2, cy = H/2;
    this.items.forEach((n,i) => {
      ctx.save();
      ctx.translate(cx, cy-20-i*32);
      ctx.scale(n.scale, n.scale);
      ctx.globalAlpha = n.scale;
      ctx.font='bold 22px Arial';
      ctx.textAlign='center';
      ctx.strokeStyle='rgba(0,0,0,0.7)'; ctx.lineWidth=4;
      ctx.strokeText(n.text,0,0);
      ctx.fillStyle=n.color;
      ctx.fillText(n.text,0,0);
      ctx.restore();
    });
    ctx.globalAlpha=1;
  }
}

// ============================================================
// TOUCH CONTROLS
// ============================================================
class TouchControls {
  constructor() {
    this.active = IS_TOUCH;
    this.steer = 0; this.gas = false; this.brake = false; this.nitro = false; this.useItem = false;
    this.joyBase = {x:0,y:0}; this.joyThumb = {x:0,y:0}; this.joyId = null;
    this.btnIds = {gas:null,brk:null,nit:null,itm:null};
    this.btnState = {gas:false,brk:false,nit:false,itm:false};
    if (IS_TOUCH) this._bind();
  }
  _bind() {
    window.addEventListener('touchstart', e => this._onStart(e), {passive:false});
    window.addEventListener('touchmove',  e => this._onMove(e), {passive:false});
    window.addEventListener('touchend',   e => this._onEnd(e), {passive:false});
  }
  _btnRect(W,H,idx) {
    const bx = W-170, by = H-170;
    const bw=70, bh=70, gap=8;
    const col=idx%2, row=Math.floor(idx/2);
    return {x:bx+col*(bw+gap),y:by+row*(bh+gap),w:bw,h:bh};
  }
  _onStart(e) {
    e.preventDefault();
    const W=window.innerWidth, H=window.innerHeight;
    for (const t of e.changedTouches) {
      const tx=t.clientX,ty=t.clientY;
      if (tx<W/2) {
        this.joyId=t.identifier;
        this.joyBase={x:tx,y:ty};
        this.joyThumb={x:tx,y:ty};
      } else {
        for (let i=0;i<4;i++) {
          const r=this._btnRect(W,H,i);
          if (tx>=r.x&&tx<=r.x+r.w&&ty>=r.y&&ty<=r.y+r.h) {
            const k=['gas','brk','nit','itm'][i];
            this.btnIds[k]=t.identifier; this.btnState[k]=true;
          }
        }
      }
    }
  }
  _onMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier===this.joyId) {
        this.joyThumb={x:t.clientX,y:t.clientY};
        const dx=this.joyThumb.x-this.joyBase.x;
        this.steer=clamp(dx/50,-1,1);
      }
    }
  }
  _onEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier===this.joyId) { this.joyId=null; this.steer=0; }
      for (const k of ['gas','brk','nit','itm']) {
        if (this.btnIds[k]===t.identifier) { this.btnIds[k]=null; this.btnState[k]=false; }
      }
    }
  }
  getInput() {
    return { steer:this.steer, gas:this.btnState.gas, brake:this.btnState.brk, nitro:this.btnState.nit, useItem:this.btnState.itm };
  }
  draw(ctx, W, H) {
    if (!this.active) return;
    ctx.save();
    // Joystick
    ctx.globalAlpha=0.35;
    ctx.fillStyle='#aaa';
    ctx.beginPath(); ctx.arc(this.joyBase.x||120, this.joyBase.y||(H-120), 50,0,PI2); ctx.fill();
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(this.joyThumb.x||(this.joyBase.x||120), this.joyThumb.y||(this.joyBase.y||(H-120)), 24,0,PI2); ctx.fill();
    // Buttons
    const labels=['GAS','BRK','NIT','ITM'];
    const colors=['#20c040','#e83030','#9040cc','#f0c030'];
    for (let i=0;i<4;i++) {
      const r=this._btnRect(W,H,i);
      ctx.globalAlpha=0.45;
      ctx.fillStyle=colors[i];
      ctx.beginPath(); ctx.roundRect(r.x,r.y,r.w,r.h,8); ctx.fill();
      ctx.globalAlpha=0.9;
      ctx.fillStyle='#fff'; ctx.font='bold 14px Arial'; ctx.textAlign='center';
      ctx.fillText(labels[i],r.x+r.w/2,r.y+r.h/2+5);
    }
    ctx.globalAlpha=1;
    ctx.restore();
  }
}

// ============================================================
// MENU SYSTEM
// ============================================================
class MenuSystem {
  constructor() {
    this.sel = {car:0,color:0,track:0,diff:1,weather:0};
    this._load();
    this._buildUI();
    this._bindEvents();
  }
  _load() {
    try { const d=JSON.parse(localStorage.getItem('racingPrefs')); if(d) Object.assign(this.sel,d); } catch(e){}
  }
  _save() {
    try { localStorage.setItem('racingPrefs',JSON.stringify(this.sel)); } catch(e){}
  }
  _buildUI() {
    this._buildSel('carSel', CARS.map(c=>c.name), 'car');
    this._buildColors();
    this._buildSel('trkSel', TRACKS.map(t=>t.name), 'track');
    this._buildSel('difSel', DIFFICULTIES.map(d=>d.name), 'diff');
    this._buildSel('wxSel', WEATHERS, 'weather');
    this._updateStats();
  }
  _buildSel(id, items, key) {
    const el = document.getElementById(id);
    if (!el) return;
    if (key === 'track') {
      el.innerHTML = items.map((name,i) => {
        let bestLabel = '';
        try {
          const stored = localStorage.getItem('bestLap_' + name);
          if (stored) bestLabel = ` <span style="font-size:0.6rem;color:#88cc88">⏱${formatTime(parseInt(stored))}</span>`;
        } catch(e) {}
        return `<button class="menu-btn${this.sel[key]===i?' selected':''}" data-key="${key}" data-idx="${i}">${name}${bestLabel}</button>`;
      }).join('');
    } else {
      el.innerHTML = items.map((name,i) =>
        `<button class="menu-btn${this.sel[key]===i?' selected':''}" data-key="${key}" data-idx="${i}">${name}</button>`
      ).join('');
    }
  }
  _buildColors() {
    const el = document.getElementById('colSel');
    if (!el) return;
    el.innerHTML = COLORS.map((c,i) =>
      `<div class="color-btn${this.sel.color===i?' selected':''}" data-key="color" data-idx="${i}" style="background:${c}"></div>`
    ).join('');
  }
  _updateStats() {
    const cfg = CARS[this.sel.car];
    const fields = {stSpeed:cfg.topSpeed/300,stAccel:cfg.accel/0.4,stBrake:cfg.brake/0.5,stGrip:cfg.grip};
    for (const [id,val] of Object.entries(fields)) {
      const el=document.getElementById(id);
      if(el) el.style.width=Math.round(val*100)+'%';
    }
  }
  _bindEvents() {
    const inner=document.getElementById('menuInner');
    if (!inner) return;
    inner.addEventListener('click', e => {
      const el=e.target.closest('[data-key]');
      if (!el) return;
      const key=el.dataset.key, idx=+el.dataset.idx;
      this.sel[key]=idx; this._save();
      // Refresh buttons
      ['carSel','trkSel','difSel','wxSel'].forEach(sid => {
        const cont=document.getElementById(sid);
        if (!cont) return;
        cont.querySelectorAll('.menu-btn').forEach((b,i) => b.classList.toggle('selected', i===this.sel[b.dataset.key]));
      });
      document.querySelectorAll('.color-btn').forEach((b,i)=>b.classList.toggle('selected',i===this.sel.color));
      this._updateStats();
    });
  }
  getConfig() {
    return {
      carConfig: CARS[this.sel.car],
      color: COLORS[this.sel.color],
      track: TRACKS[this.sel.track],
      difficulty: DIFFICULTIES[this.sel.diff],
      weather: WEATHERS[this.sel.weather]
    };
  }
}

// ============================================================
// INPUT STATE
// ============================================================
class InputState {
  constructor() {
    this.keys = {};
    this.steer=0; this.gas=false; this.brake=false; this.handbrake=false;
    this.nitro=false; this.useItem=false; this.pause=false; this.rearView=false;
    window.addEventListener('keydown', e => {
      this.keys[e.code]=true;
      if (e.code==='KeyP') { this.pause=true; e.preventDefault(); }
      if (e.code==='KeyE') { this.useItem=true; e.preventDefault(); }
      if (e.code==='Tab')  { this.rearView=true; e.preventDefault(); }
      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => {
      this.keys[e.code]=false;
      if (e.code==='KeyP') this.pause=false;
      if (e.code==='KeyE') this.useItem=false;
      if (e.code==='Tab')  this.rearView=false;
    });
  }
  poll(touchInput) {
    const k=this.keys;
    let steer=0;
    if (k['ArrowLeft']||k['KeyA']) steer=-1;
    if (k['ArrowRight']||k['KeyD']) steer=1;
    if (touchInput) steer = steer || touchInput.steer;
    this.steer=steer;
    this.gas      = !!(k['ArrowUp']||k['KeyW']||(touchInput&&touchInput.gas));
    this.brake    = !!(k['ArrowDown']||k['KeyS']||(touchInput&&touchInput.brake));
    this.handbrake= !!(k['Space']);
    this.nitro    = !!(k['ShiftLeft']||k['ShiftRight']||(touchInput&&touchInput.nitro));
    if (touchInput&&touchInput.useItem) this.useItem=true;
  }
}

// ============================================================
// GAME
// ============================================================
class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.W = 0; this.H = 0;
    this.dpr = window.devicePixelRatio || 1;
    this.state = 'menu'; // menu|countdown|racing|paused|finished
    this.audio   = new AudioEngine();
    this.particles= new Particles();
    this.tireMarks= new TireMarks();
    this.weather  = new Weather();
    this.ghost    = new Ghost();
    this.notifs   = new Notifications();
    this.touch    = new TouchControls();
    this.menu     = new MenuSystem();
    this.input    = new InputState();
    this.track    = null;
    this.player   = null;
    this.ais      = [];
    this.oilSlicks= [];
    this.missiles = [];
    this.shake    = 0;
    this.cameraX  = 3200; this.cameraY = 2800;
    this.raceTime = 0;
    this.fps      = 60;
    this._fpsArr  = [];
    this._lastTime= 0;
    this._raf     = null;
    this._useItemFlag = false;
    this._hornCooldown = 0;
    this._resize();
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('blur',   () => { if (this.state==='racing') this.state='paused'; });
    if (IS_TOUCH) document.body.classList.add('touch-device');
    // Start button
    const startBtn = document.getElementById('startBtn');
    if (startBtn) startBtn.addEventListener('click', () => this._startRace());
    // Finish button
    const finBtn = document.getElementById('finBtn');
    if (finBtn) finBtn.addEventListener('click', () => this._toMenu());
    // Play Again button
    const playAgainBtn = document.getElementById('playAgainBtn');
    if (playAgainBtn) playAgainBtn.addEventListener('click', () => {
      document.getElementById('finishScreen').classList.add('hide');
      this._initRace(this.menu.getConfig());
    });
    // Sound button
    const sndBtn = document.getElementById('soundBtn');
    if (sndBtn) sndBtn.addEventListener('click', () => {
      const on=this.audio.toggle();
      sndBtn.textContent=on?'🔊':'🔇';
    });
    // Keyboard shortcuts
    window.addEventListener('keydown', e => {
      if (e.code==='KeyP') {
        if (this.state==='racing') this._pause();
        else if (this.state==='paused') this._resume();
      }
      if (e.code==='KeyM') this.audio.toggle();
      if (e.code==='KeyE' && this.state==='racing') this._useItemFlag=true;
    });
    this._loop(0);
  }
  _resize() {
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width  = this.W * this.dpr;
    this.canvas.height = this.H * this.dpr;
    this.canvas.style.width  = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this.ctx.scale(this.dpr, this.dpr);
  }
  _startRace() {
    const cfg = this.menu.getConfig();
    this.audio.start();
    this._initRace(cfg);
  }
  _initRace(cfg) {
    document.getElementById('menuScreen').classList.add('hide');
    document.getElementById('finishScreen').classList.add('hide');
    this.track = new Track(cfg.track);
    this.weather.setWeather(cfg.weather);
    const start = this.track.spline[0];
    const startH = Math.atan2(this.track.spline[1].y-start.y, this.track.spline[1].x-start.x);
    this.player = new Player(start.x, start.y + 60, startH, cfg.color, 'You', cfg.carConfig);
    this.player.lapStart = Date.now();
    this.ais = [];
    const numAI = 5;
    for (let i=0;i<numAI;i++) {
      const aiName = AI_NAMES[i % AI_NAMES.length];
      const aiColor = AI_COLORS[i % AI_COLORS.length];
      const aiCfg = CARS[i % CARS.length];
      const offset = (i+1) * 55;
      const ax = start.x - Math.cos(startH)*offset;
      const ay = start.y - Math.sin(startH)*offset;
      const ai = new AI(ax, ay+rng(-15,15), startH, aiColor, aiName, aiCfg, cfg.difficulty.skill);
      this.ais.push(ai);
    }
    this.oilSlicks = [];
    this.missiles  = [];
    this.particles  = new Particles();
    this.tireMarks  = new TireMarks();
    this.ghost.reset();
    this.ghost.startPlayback();
    this.raceTime = 0;
    this.shake    = 0;
    this.state    = 'countdown';
    this._countdown();
  }
  _countdown() {
    const el   = document.getElementById('countdownScreen');
    const num  = document.getElementById('cntNum');
    el.classList.remove('hide');
    let count = 3;
    const COLORS_CD = {3:'#ff4040', 2:'#f0c030', 1:'#ff8020', 0:'#60ff60'};
    const tick = () => {
      num.textContent = count > 0 ? count : 'GO!';
      num.style.color = COLORS_CD[count] || '#ffe060';
      num.style.textShadow = `0 0 40px ${COLORS_CD[count]}aa, 0 4px 0 rgba(0,0,0,0.4)`;
      num.style.animation = 'none';
      void num.offsetWidth;
      num.style.animation = 'cntPulse 0.4s ease-out';
      if (count > 0) this.audio.playEffect('countdown');
      else this.audio.playEffect('go');
      if (count > 0) { count--; setTimeout(tick, 1000); }
      else { setTimeout(() => { el.classList.add('hide'); this.state='racing'; }, 700); }
    };
    tick();
  }
  _pause() {
    this.state='paused';
    document.getElementById('pauseScreen').classList.remove('hide');
  }
  _resume() {
    this.state='racing';
    document.getElementById('pauseScreen').classList.add('hide');
  }
  _toMenu() {
    document.getElementById('finishScreen').classList.add('hide');
    document.getElementById('menuScreen').classList.remove('hide');
    this.state='menu';
    this.player=null; this.ais=[]; this.track=null;
  }
  _update(dt) {
    // Keep updating particles even after finish for confetti effect
    if (this.state === 'finished') { this.particles.update(dt); this.notifs.update(dt); return; }
    if (this.state !== 'racing') return;
    this.raceTime += dt;
    // Input
    const ti = this.touch.active ? this.touch.getInput() : null;
    this.input.poll(ti);
    if (this._useItemFlag) {
      this.player.useItem(this.oilSlicks, this.missiles, this.particles, this.audio, this.ais);
      this._useItemFlag=false;
      this.input.useItem=false;
    }
    if (this.input.useItem) {
      this.player.useItem(this.oilSlicks, this.missiles, this.particles, this.audio, this.ais);
      this.input.useItem=false;
    }
    // Horn sound (H key)
    if (this.input.keys['KeyH']) {
      if (!this._hornCooldown) {
        this.audio.playEffect('horn');
        this._hornCooldown = 600;
      }
    }
    if (this._hornCooldown) this._hornCooldown = Math.max(0, this._hornCooldown - dt);
    // Weather
    this.weather.update(dt);
    // Player
    this.player.update(dt, this.input, this.track, this.weather, this.track.itemBoxes, this.oilSlicks, this.missiles, this.particles, this.audio, this.ghost, this.ais);
    // Apply wall-hit shake accumulated in player update
    if (this.player.pendingShake) { this.shake += this.player.pendingShake; this.player.pendingShake = 0; }
    // Add tire marks if drifting
    if (this.player.drifting) this.tireMarks.add(this.player.x, this.player.y, this.player.heading);
    // AIs
    const allCars = [this.player, ...this.ais];
    for (const ai of this.ais) {
      ai.update(dt, this.track, this.player.x, this.player.y, allCars, this.track.itemBoxes, this.oilSlicks, this.weather, this.missiles, this.particles);
      // Rubber-banding: AI far behind gets a small speed boost; far ahead slows slightly
      const gap = this.player.totalDist - ai.totalDist;
      if (gap > RUBBER_BAND_THRESHOLD) ai.speed *= (1 + clamp((gap - RUBBER_BAND_THRESHOLD) / RUBBER_BAND_CATCH_UP, 0, RUBBER_BAND_MAX_BOOST));
      else if (gap < -RUBBER_BAND_THRESHOLD) ai.speed *= (1 - clamp((-gap - RUBBER_BAND_THRESHOLD) / RUBBER_BAND_SLOW_DOWN, 0, RUBBER_BAND_MAX_SLOW));
    }
    // Item boxes update
    for (const ib of this.track.itemBoxes) ib.update(dt);
    // Oil slicks
    for (const o of this.oilSlicks) o.update(dt);
    this.oilSlicks = this.oilSlicks.filter(o=>o.active);
    // Missiles: each missile hits all cars except its owner
    for (const m of this.missiles) {
      const hitTargets = allCars.filter(c => c !== m.owner);
      m.update(dt, hitTargets);
    }
    this.missiles = this.missiles.filter(m=>m.active);
    // Collisions — cooldown per pair to prevent frame-by-frame chaos
    const now = Date.now();
    if (!this._colCooldowns) this._colCooldowns = {};
    for (let i=0;i<allCars.length;i++) {
      for (let j=i+1;j<allCars.length;j++) {
        const a=allCars[i], b=allCars[j];
        const d=dist(a.x,a.y,b.x,b.y);
        const collisionR = 46;
        if (d < collisionR && d > 0.1) {
          const key = i + ':' + j;
          const lastHit = this._colCooldowns[key] || 0;
          const nx=(a.x-b.x)/d, ny=(a.y-b.y)/d;
          // Soft separation: push only 40% of overlap per frame
          const sep = (collisionR - d) * 0.4;
          a.x += nx*sep; a.y += ny*sep;
          b.x -= nx*sep; b.y -= ny*sep;
          if (now - lastHit > 300) {
            this._colCooldowns[key] = now;
            // Impulse-based speed response using relative velocity along normal
            const avx = Math.cos(a.heading)*a.speed - Math.sin(a.heading)*a.lateralSpeed;
            const avy = Math.sin(a.heading)*a.speed + Math.cos(a.heading)*a.lateralSpeed;
            const bvx = Math.cos(b.heading)*b.speed - Math.sin(b.heading)*b.lateralSpeed;
            const bvy = Math.sin(b.heading)*b.speed + Math.cos(b.heading)*b.lateralSpeed;
            const relVn = (avx-bvx)*nx + (avy-bvy)*ny;
            if (relVn > 0) {
              const imp = relVn * 0.55;
              const aSpeed = (Math.cos(a.heading)*(avx - imp*nx) + Math.sin(a.heading)*(avy - imp*ny));
              const bSpeed = (Math.cos(b.heading)*(bvx + imp*nx) + Math.sin(b.heading)*(bvy + imp*ny));
              a.speed = aSpeed * 0.88;
              b.speed = bSpeed * 0.88;
              // Gentle deflection based on impact angle — no random spin
              const impactAngle = Math.atan2(ny, nx);
              a.angularVel += angleDiff(a.heading, impactAngle) * 0.08;
              b.angularVel -= angleDiff(b.heading, impactAngle) * 0.08;
            }
            const mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
            this.particles.burst(mx,my,8,{color:'#ffff80',minSpd:80,maxSpd:160,life:400,size:4});
            if (a===this.player||b===this.player) {
              if (!this.player.activeEffects.shield && !this.player.activeEffects.ghost_mode) {
                this.player.hp-=3;
                this.shake+=8;
                this.audio.playEffect('impact');
              }
            }
          }
        }
      }
    }
    // Ghost
    const gf=this.ghost.getFrame();
    this._ghostFrame=gf;
    // Particles & tire marks
    this.particles.update(dt);
    this.tireMarks.update(dt);
    if (Math.random()<0.01) this.tireMarks.prune();
    this.notifs.update(dt);
    // Smooth camera with velocity lookahead
    const rv = this.input.rearView;
    const dir = rv ? -1 : 1;
    const lookahead = rv ? CAMERA_LOOKAHEAD_REV : CAMERA_LOOKAHEAD_FWD;
    const targetCamX = this.player.x + dir * Math.cos(this.player.heading) * lookahead;
    const targetCamY = this.player.y + dir * Math.sin(this.player.heading) * lookahead;
    this.cameraX = damp(this.cameraX, targetCamX, CAMERA_DAMPING, dt * 0.001);
    this.cameraY = damp(this.cameraY, targetCamY, CAMERA_DAMPING, dt * 0.001);
    this.shake *= 0.88;
    // HUD
    this._updateHUD();
    // Position board
    this._updatePosBoard(allCars);
    // Check finish
    if (this.player.finished && this.state==='racing') {
      const pos = allCars.filter(c=>c.finished).length;
      this._end(pos);
    }
  }
  _updateHUD() {
    const p=this.player;
    const setText=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
    const setWidth=(id,w)=>{const e=document.getElementById(id);if(e)e.style.width=clamp(w,0,100)+'%';};
    setText('vSpd',Math.round(Math.abs(p.speed))+' km/h');
    setText('vRpm',Math.round(p.rpm));
    setText('vGear',p.gear||'N');
    setText('vTire',Math.round(p.tires)+'%');
    const fx=Object.keys(p.activeEffects).join(' ')||'—';
    setText('vAct',fx);
    setWidth('bF',p.fuel);
    setWidth('bH',p.hp);
    setWidth('bN',p.nitro/p.carConfig.nitroMax*100);
    const allCars=[this.player,...this.ais];
    const sorted=[...allCars].sort((a,b)=>b.totalDist-a.totalDist);
    const pos=sorted.indexOf(this.player)+1;
    setText('vPos',pos+'/'+allCars.length);
    setText('vLap',p.lapCount+'/'+TOTAL_LAPS);
    setText('vTime',formatTime(this.raceTime));
    setText('vLT',p.lastLapTime?formatTime(p.lastLapTime):'—');
    setText('vBest',p.bestLap?formatTime(p.bestLap):'—');
    setText('vScr',Math.round(p.score));
    setText('vDrf',Math.round(p.driftScore));
    setText('vFps',Math.round(this.fps));
    for (let i=0;i<3;i++) {
      const e=document.getElementById('sl'+i);
      if(e) e.textContent = p.inventory[i] ? (ITEM_EMOJI[p.inventory[i]]||'?') : '';
      if(e) e.classList.toggle('active', i===0&&!!p.inventory[0]);
    }
    const wi=document.getElementById('weatherInd');
    if(wi) wi.textContent=this.weather.getIndicatorText();
  }
  _updatePosBoard(allCars) {
    const sorted=[...allCars].sort((a,b)=>b.totalDist-a.totalDist);
    const pbRows=document.getElementById('pbRows');
    if (!pbRows) return;
    pbRows.innerHTML=sorted.map((c,i)=>{
      const isYou=c===this.player;
      return `<div class="pb-row${isYou?' pb-you':''}">
        <span class="pb-pos">${i+1}</span>
        <span class="pb-dot" style="background:${c.color}"></span>
        <span class="pb-name">${c.name}</span>
        <span class="pb-lap">${c.lapCount}</span>
      </div>`;
    }).join('');
  }
  _draw() {
    const ctx=this.ctx, W=this.W, H=this.H;
    ctx.save();
    // Screen shake
    if (this.shake>0.5) ctx.translate(rng(-this.shake,this.shake)*0.5, rng(-this.shake,this.shake)*0.5);
    // Clear
    ctx.fillStyle='#3a7a2a';
    ctx.fillRect(0,0,W,H);
    if (!this.track || !this.player) { ctx.restore(); return; }
    // World transform
    ctx.save();
    ctx.translate(W/2 - this.cameraX, H/2 - this.cameraY);
    // Track
    this.track.draw(ctx);
    // Tire marks
    this.tireMarks.draw(ctx);
    // Oil slicks
    for (const o of this.oilSlicks) o.draw(ctx);
    // Item boxes
    for (const ib of this.track.itemBoxes) ib.draw(ctx);
    // Missiles
    for (const m of this.missiles) m.draw(ctx);
    // Ghost
    this.ghost.draw(ctx, this._ghostFrame);
    // Particles (below)
    this.particles.draw(ctx, this.cameraX, this.cameraY, W, H);
    // Cars sorted by Y
    const allCars=[this.player,...this.ais];
    allCars.sort((a,b)=>a.y-b.y);
    for (const c of allCars) c.draw(ctx);
    ctx.restore();
    // Weather effects (screen space)
    this.weather.draw(ctx, W, H, this.player.x, this.player.y, this.player.heading);
    // Speed lines
    drawSpeedLines(ctx, W, H, Math.abs(this.player.speed)/this.player.carConfig.topSpeed);
    // Rear view indicator
    if (this.input.rearView) {
      ctx.save();
      ctx.fillStyle='rgba(255,200,50,0.85)';
      ctx.font='bold 18px Arial'; ctx.textAlign='center';
      ctx.fillText('◄ REAR VIEW ►', W/2, 38);
      ctx.restore();
    }
    // Notifications
    this.notifs.draw(ctx, W, H);
    // Touch controls
    this.touch.draw(ctx, W, H);
    ctx.restore();
    // Minimap (screen space, no world transform)
    this._drawMinimap();
    // Tachometer
    this._drawTacho();
  }
  _drawMinimap() {
    if (!this.track || !this.player) return;
    const mCanvas=document.getElementById('mini');
    if (!mCanvas) return;
    const mc=mCanvas.getContext('2d');
    const MW=155, MH=155;
    mc.clearRect(0,0,MW,MH);
    mc.fillStyle='rgba(8,10,18,0.7)';
    mc.fillRect(0,0,MW,MH);
    // Compute scale & offset to fit track dynamically
    const cx=this.track.center[0], cy=this.track.center[1];
    // Determine max extent of spline from center for auto-scaling
    let maxR = 0;
    for (const sp of this.track.spline) {
      const r = dist(sp.x, sp.y, cx, cy);
      if (r > maxR) maxR = r;
    }
    const padding = 12;
    const scale = maxR > 0 ? (MW/2 - padding) / maxR : 0.033;
    const ox=MW/2-cx*scale, oy=MH/2-cy*scale;
    this.track.drawMinimap(mc,scale,ox,oy);
    // Cars
    const allCars=[this.player,...this.ais];
    for (const c of allCars) {
      const mx=c.x*scale+ox, my=c.y*scale+oy;
      mc.fillStyle=c===this.player?'#ffffff':c.color;
      mc.beginPath(); mc.arc(mx,my,c===this.player?4:2.5,0,PI2); mc.fill();
    }
  }
  _drawTacho() {
    if (!this.player) return;
    const tc=document.getElementById('tacho');
    if (!tc) return;
    const tctx=tc.getContext('2d');
    drawTachometer(tctx, this.player.rpm, 8000, this.player.gear||'N', Math.abs(this.player.speed));
  }
  _end(position) {
    this.state='finished';
    const p=this.player;
    // Position-based points (F1-style)
    const POS_PTS = [25,18,15,12,10,8,6,4,2,1];
    const racePoints = POS_PTS[Math.max(0, position-1)] || 0;
    p.score += racePoints * 100;
    // Track record (best lap per track)
    let newRecord = false;
    if (p.bestLap) {
      try {
        const key = 'bestLap_' + this.track.config.name;
        const stored = parseInt(localStorage.getItem(key)) || Infinity;
        if (p.bestLap < stored) {
          localStorage.setItem(key, p.bestLap);
          newRecord = true;
        }
      } catch(e) {}
    }
    if (newRecord) {
      this.notifs.add('🏆 NEW TRACK RECORD!', '#f0c040', 4000);
    }
    // Confetti burst
    const confettiColors = ['#ff4444','#44aaff','#44ff88','#ffcc00','#ff44ff','#ff8800','#00ffcc','#ff6666'];
    for (let i = 0; i < 55; i++) {
      const a = rng(0, PI2), spd = rng(100, 320);
      this.particles.emit(this.player.x, this.player.y, {
        vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
        color: confettiColors[Math.floor(Math.random()*confettiColors.length)],
        size: rng(3,8), life: rng(2500,4500), drag: 0.96, gravity: 0.06
      });
    }
    const ordinals=['','1st','2nd','3rd','4th','5th','6th'];
    document.getElementById('finTitle').textContent=`You finished ${ordinals[position]||position+'th'}!`;
    const statsEl=document.getElementById('finStats');
    const trackKey = 'bestLap_' + this.track.config.name;
    let trackRecord = '—';
    try { const s = localStorage.getItem(trackKey); if (s) trackRecord = formatTime(parseInt(s)); } catch(e) {}
    const rows=[
      ['Position', ordinals[position]||position+'th'],
      ['Total Time', formatTime(this.raceTime)],
      ['Best Lap', p.bestLap?formatTime(p.bestLap):'—'],
      ['Track Record', trackRecord + (newRecord ? ' 🏆' : '')],
      ['Race Points', '+' + racePoints + ' pts'],
      ['Score', Math.round(p.score)],
      ['Drift Score', Math.round(p.driftScore)],
      ['Laps', TOTAL_LAPS+'/'+TOTAL_LAPS]
    ];
    statsEl.innerHTML=rows.map(([l,v])=>`<div class="fin-row"><span class="fin-label">${l}</span><span class="fin-val">${v}</span></div>`).join('');
    document.getElementById('finishScreen').classList.remove('hide');
  }
  _loop(ts) {
    if (this._lastTime === 0) { this._lastTime = ts; requestAnimationFrame(t => this._loop(t)); return; }
    const dt = Math.min(ts - this._lastTime, 33);
    this._lastTime = ts;
    // FPS
    this._fpsArr.push(1000/Math.max(dt,1));
    if (this._fpsArr.length>30) this._fpsArr.shift();
    this.fps = this._fpsArr.reduce((a,b)=>a+b,0)/this._fpsArr.length;
    this._update(dt);
    this._draw();
    this._raf = requestAnimationFrame(t => this._loop(t));
  }
}

// ============================================================
// BOOT
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
