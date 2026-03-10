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
    center:[2400,2000],
    points:[
      {r:600,a:0},{r:620,a:0.32},{r:580,a:0.65},{r:500,a:0.95},
      {r:450,a:1.25},{r:480,a:1.60},{r:550,a:1.90},{r:640,a:2.20},
      {r:650,a:2.55},{r:600,a:2.88},{r:520,a:3.20},{r:440,a:3.50},
      {r:380,a:3.85},{r:400,a:4.20},{r:470,a:4.55},{r:540,a:4.85},
      {r:580,a:5.15},{r:610,a:5.45},{r:630,a:5.75},{r:615,a:6.00},
      {r:605,a:6.20},{r:600,a:6.28}
    ]
  },
  {
    name:'Tight Twister',
    center:[2400,2000],
    points:[
      {r:400,a:0},{r:380,a:0.45},{r:300,a:0.90},{r:260,a:1.35},
      {r:300,a:1.80},{r:380,a:2.25},{r:450,a:2.70},{r:480,a:3.14},
      {r:460,a:3.60},{r:400,a:4.05},{r:320,a:4.50},{r:260,a:4.95},
      {r:300,a:5.40},{r:360,a:5.85},{r:400,a:6.28}
    ]
  },
  {
    name:'Oval Speedway',
    center:[2400,2000],
    points:[
      {r:500,a:0},{r:480,a:0.40},{r:320,a:0.80},{r:300,a:1.57},
      {r:320,a:2.35},{r:480,a:2.75},{r:500,a:3.14},
      {r:480,a:3.54},{r:320,a:3.93},{r:300,a:4.71},{r:320,a:5.50},{r:480,a:5.90},{r:500,a:6.28}
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
const TOTAL_LAPS = 5;
const ROAD_WIDTH = 260;
const WALL_HIT_COOLDOWN_MS = 300;
const PLAYER_WALL_RESTITUTION = 0.35;
const PLAYER_WALL_SPEED_FACTOR = 0.5;
const AI_WALL_RESTITUTION = 0.2;
const AI_WALL_SPEED_FACTOR = 0.6;
const AI_ITEM_USE_RATE = 0.0015;       // probability per ms that AI uses an item
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
      const ha = heading - PI/2;
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
      if (dist(this.x, this.y, car.x, car.y) < 30) {
        car.angularVel = (Math.random()-0.5)*2;
        car.speed *= 0.3;
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
    ctx.rotate(frame.heading - PI/2);
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
    // Precompute grass texture dots (decorative)
    this._grassDots = [];
    for (let i = 0; i < SN; i += 3) {
      const sp = this.spline[i];
      const nx = this.normals[i].nx, ny = this.normals[i].ny;
      for (let side = -1; side <= 1; side += 2) {
        const off = rng(ROAD_WIDTH/2 + 16, ROAD_WIDTH/2 + 150);
        this._grassDots.push({
          x: sp.x + nx * off * side + rng(-12, 12),
          y: sp.y + ny * off * side + rng(-12, 12),
          r: rng(1, 3.5),
          dark: Math.random() > 0.55
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
    // Fallback: if grid missed (car far off track), do coarse scan
    if (bestDist === Infinity) {
      for (let i = 0; i < SN; i += 8) {
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
    // Grass texture dots
    for (const d of this._grassDots) {
      ctx.fillStyle = d.dark ? '#2a5c18' : '#3d7a28';
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, PI2); ctx.fill();
    }
    // Shoulder (wider grey/sand)
    ctx.strokeStyle='#c8b89a'; ctx.lineWidth=ROAD_WIDTH+36;
    ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.beginPath();
    ctx.moveTo(this.spline[0].x,this.spline[0].y);
    for (let i=1;i<SN;i++) ctx.lineTo(this.spline[i].x,this.spline[i].y);
    ctx.closePath(); ctx.stroke();
    // Rumble strips – white base dashes
    ctx.strokeStyle='#ffffff'; ctx.lineWidth=ROAD_WIDTH+10;
    ctx.setLineDash([28,28]); ctx.lineDashOffset=0;
    ctx.beginPath();
    ctx.moveTo(this.spline[0].x,this.spline[0].y);
    for (let i=1;i<SN;i++) ctx.lineTo(this.spline[i].x,this.spline[i].y);
    ctx.closePath(); ctx.stroke();
    // Rumble strips – red dashes offset to fill gaps (alternating red/white)
    ctx.strokeStyle='#dd2222'; ctx.lineDashOffset=28;
    ctx.beginPath();
    ctx.moveTo(this.spline[0].x,this.spline[0].y);
    for (let i=1;i<SN;i++) ctx.lineTo(this.spline[i].x,this.spline[i].y);
    ctx.closePath(); ctx.stroke();
    ctx.setLineDash([]); ctx.lineDashOffset=0;
    // Asphalt road surface
    ctx.strokeStyle='#2a2a2e'; ctx.lineWidth=ROAD_WIDTH;
    ctx.beginPath();
    ctx.moveTo(this.spline[0].x,this.spline[0].y);
    for (let i=1;i<SN;i++) ctx.lineTo(this.spline[i].x,this.spline[i].y);
    ctx.closePath(); ctx.stroke();
    // Asphalt surface patches (subtle dark variation)
    ctx.fillStyle='rgba(0,0,0,0.06)';
    for (const p of this._asphaltPatches) {
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.a);
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
    }
    // Center dashed line
    ctx.strokeStyle='rgba(255,224,96,0.55)'; ctx.lineWidth=3; ctx.setLineDash([24,20]);
    ctx.beginPath();
    ctx.moveTo(this.spline[0].x,this.spline[0].y);
    for (let i=1;i<SN;i++) ctx.lineTo(this.spline[i].x,this.spline[i].y);
    ctx.closePath(); ctx.stroke();
    ctx.setLineDash([]);
    // Checkered start/finish line
    const sf = this.spline[0];
    const sfn = this.normals[0];
    const sq = 13; // square size
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
    // Trees
    for (const t of this.trees) {
      ctx.fillStyle='#2d6e20';
      ctx.beginPath(); ctx.arc(t.x,t.y,t.r,0,PI2); ctx.fill();
      ctx.fillStyle='#3d8a2a';
      ctx.beginPath(); ctx.arc(t.x-t.r*0.2,t.y-t.r*0.2,t.r*0.65,0,PI2); ctx.fill();
    }
    // Grandstands
    for (const g of this.grandstands) {
      ctx.save(); ctx.translate(g.x,g.y); ctx.rotate(g.angle);
      ctx.fillStyle='#888899';
      ctx.fillRect(-g.w/2,-g.h/2,g.w,g.h);
      ctx.strokeStyle='#aaaacc'; ctx.lineWidth=1;
      for (let r=0;r<4;r++) {
        ctx.beginPath(); ctx.moveTo(-g.w/2, -g.h/2+r*(g.h/4)); ctx.lineTo(g.w/2, -g.h/2+r*(g.h/4)); ctx.stroke();
      }
      ctx.restore();
    }
  }
  drawMinimap(ctx, scale, ox, oy) {
    const SN = this.spline.length;
    ctx.strokeStyle='rgba(100,140,200,0.7)'; ctx.lineWidth=6*scale;
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
    ctx.rotate(this.heading - PI/2);
    // Shadow
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(4, 5, 19, 32, 0, 0, PI2); ctx.fill();
    ctx.globalAlpha = 1;
    // Body
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.roundRect(-17,-29,34,58,4);
    ctx.fill();
    // Windshield
    ctx.fillStyle='rgba(120,200,255,0.5)';
    ctx.fillRect(-12,-20,24,14);
    // Wheels
    ctx.fillStyle='#111';
    ctx.fillRect(-22,-22,7,16);
    ctx.fillRect(15,-22,7,16);
    ctx.fillRect(-22,14,7,16);
    ctx.fillRect(15,14,7,16);
    // Headlights
    ctx.fillStyle='rgba(255,255,190,0.92)';
    ctx.beginPath(); ctx.arc(-9,-26,4,0,PI2); ctx.fill();
    ctx.beginPath(); ctx.arc(9,-26,4,0,PI2); ctx.fill();
    // Tail lights
    ctx.fillStyle='#cc1111';
    ctx.fillRect(-13,24,9,5);
    ctx.fillRect(4,24,9,5);
    ctx.restore();
    // Name tag
    ctx.fillStyle='rgba(0,0,0,0.5)';
    ctx.fillRect(this.x-22,this.y-42,44,14);
    ctx.fillStyle='#fff';
    ctx.font='9px Arial';
    ctx.textAlign='center';
    ctx.fillText(this.name, this.x, this.y-32);
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
          missiles.push(new Missile(this.x,this.y,h,particles));
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
      ctx.rotate(this.heading - PI/2);
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
        // Snap car back to wall boundary
        const over = nearest.dist - wallDist;
        this.x -= nx * over;
        this.y -= ny * over;
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
    this.lookahead = Math.round(lerp(6,12,skill));
    this.inventory = [null,null,null];
    this.hp = 100;
    this.stunTimer = 0;
  }
  addItem(type) {
    for (let i=0;i<3;i++) { if (!this.inventory[i]) { this.inventory[i]=type; return; } }
  }
  update(dt, track, playerX, playerY, allCars, itemBoxes, oilSlicks) {
    if (this.stunTimer > 0) { this.stunTimer -= dt; this.speed *= 0.95; return; }
    const SN = track.spline.length;
    // Find current position on track
    const nearest = track.nearest(this.x,this.y);
    this.waypointIdx = nearest.idx;
    const targetIdx = (this.waypointIdx + this.lookahead) % SN;
    const target = track.spline[targetIdx];
    // Steer toward target
    const desiredH = Math.atan2(target.y-this.y, target.x-this.x);
    const diff = angleDiff(this.heading, desiredH);
    this.steerAngle = clamp(diff * 1.2, -0.6, 0.6);
    // Oil slick avoidance – steer away if an oil slick is nearby
    if (oilSlicks) {
      for (const o of oilSlicks) {
        if (!o.active) continue;
        const od = dist(this.x, this.y, o.x, o.y);
        if (od < 90) {
          const avoidA = Math.atan2(this.y - o.y, this.x - o.x);
          this.steerAngle += clamp(angleDiff(this.heading, avoidA) * 0.4 * (1 - od/90), -0.3, 0.3);
        }
      }
    }
    // Curvature-based speed
    const curv = track.curvatureAt(targetIdx);
    const maxSpd = this.carConfig.topSpeed * this.skill * lerp(0.6, 1.0, curv);
    if (this.speed < maxSpd) this.speed += this.carConfig.accel * this.skill * dt*0.004;
    else this.speed *= 0.99;
    this.speed = clamp(this.speed, 0, this.carConfig.topSpeed);
    // Car avoidance
    for (const c of allCars) {
      if (c === this) continue;
      const d2 = dist(this.x,this.y,c.x,c.y);
      if (d2 < 80) {
        const avoidA = Math.atan2(this.y-c.y, this.x-c.x);
        this.heading += normalizeAngle(avoidA - this.heading) * 0.05;
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
        this.x -= nx * over;
        this.y -= ny * over;
        const vx = Math.cos(this.heading) * this.speed - Math.sin(this.heading) * this.lateralSpeed;
        const vy = Math.sin(this.heading) * this.speed + Math.cos(this.heading) * this.lateralSpeed;
        const dot = vx * nx + vy * ny;
        if (dot > 0) {
          const rvx = vx - (1 + AI_WALL_RESTITUTION) * dot * nx;
          const rvy = vy - (1 + AI_WALL_RESTITUTION) * dot * ny;
          this.speed = (Math.cos(this.heading) * rvx + Math.sin(this.heading) * rvy) * AI_WALL_SPEED_FACTOR;
          this.lateralSpeed = (-Math.sin(this.heading) * rvx + Math.cos(this.heading) * rvy) * AI_WALL_SPEED_FACTOR;
        }
      }
    }
    // Item pickup
    if (itemBoxes) {
      for (const ib of itemBoxes) {
        if (ib.active && dist(this.x,this.y,ib.x,ib.y)<40) ib.collect(this);
      }
    }
    // AI item usage – use items probabilistically
    if (this.inventory[0] && Math.random() < AI_ITEM_USE_RATE * dt) {
      const type = this.inventory[0];
      this.inventory.shift(); this.inventory.push(null);
      if (type === 'boost' || type === 'nitro_refill') this.speed = Math.min(this.speed * 1.4, this.carConfig.topSpeed);
      if (type === 'repair') this.hp = Math.min(100, this.hp + 40);
    }
    // Physics
    const grip = 0.9;
    if (Math.abs(this.speed) > 0.5) {
      this.angularVel = (this.speed/this.wheelbase)*Math.tan(this.steerAngle)*grip;
    }
    this.heading += this.angularVel * dt*0.001*30;
    this.angularVel = damp(this.angularVel, 0, 5, dt * 0.001);
    this.angularVel = clamp(this.angularVel, -3, 3);
    this.lateralSpeed *= Math.pow(0.15, dt * 0.001);
    this.x += (Math.cos(this.heading)*this.speed - Math.sin(this.heading)*this.lateralSpeed)*dt*0.001*60;
    this.y += (Math.sin(this.heading)*this.speed + Math.cos(this.heading)*this.lateralSpeed)*dt*0.001*60;
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
    this.cameraX  = 2400; this.cameraY = 2000;
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
      ai.update(dt, this.track, this.player.x, this.player.y, allCars, this.track.itemBoxes, this.oilSlicks);
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
    // Missiles
    const hitTargets = allCars.filter(c=>c!==this.player);
    for (const m of this.missiles) m.update(dt, hitTargets);
    this.missiles = this.missiles.filter(m=>m.active);
    // Collisions
    for (let i=0;i<allCars.length;i++) {
      for (let j=i+1;j<allCars.length;j++) {
        const a=allCars[i], b=allCars[j];
        const d=dist(a.x,a.y,b.x,b.y);
        if (d<44 && d>0.1) {
          const sep=(44-d)/2;
          const nx=(a.x-b.x)/d, ny=(a.y-b.y)/d;
          a.x+=nx*sep; a.y+=ny*sep;
          b.x-=nx*sep; b.y-=ny*sep;
          a.speed*=0.9; b.speed*=0.9;
          a.angularVel+=(Math.random()-0.5)*0.3;
          b.angularVel+=(Math.random()-0.5)*0.3;
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
    // Compute scale & offset to fit track
    const cx=this.track.center[0], cy=this.track.center[1];
    const scale=0.033;
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
