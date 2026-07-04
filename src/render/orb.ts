import type { Breathe } from '../lib/wasm';
import { f32View } from '../lib/memory';
import type { Snapshot } from '../breath/engine';
import type { Theme } from '../theme';

export interface VisualRenderer {
  frame(snap: Snapshot, dt: number): void;
  setTheme(theme: Theme): void;
  destroy(): void;
}

const GL_PARTICLES = 22_000;
const FALLBACK_PARTICLES = 1_500;
const DPR_CAP = 1.5;

// Radius of the breathing ring as a fraction of min(w, h): rest → full.
const R_MIN = 0.12;
const R_MAX = 0.4;

const VS = `#version 300 es
layout(location=0) in vec4 a_data; // x, y, size, glow
uniform vec2 u_resolution;
uniform float u_dpr;
out float v_glow;
void main() {
  vec2 clip = (a_data.xy / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_glow = a_data.w;
  gl_PointSize = a_data.z * u_dpr;
}`;

const FS = `#version 300 es
precision mediump float;
in float v_glow;
uniform vec3 u_inner;
uniform vec3 u_outer;
uniform float u_energy;
out vec4 outColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  vec3 col = mix(u_outer, u_inner, v_glow) * a * u_energy * 0.42;
  outColor = vec4(col, 1.0);
}`;

interface PointRenderer {
  draw(view: Float32Array, count: number, w: number, h: number, energy: number): void;
  setTheme(theme: Theme): void;
}

function createGlRenderer(canvas: HTMLCanvasElement, dpr: number): PointRenderer | null {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance',
  });
  if (!gl) return null;

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s) ?? 'shader compile failed');
    }
    return s;
  };

  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prog) ?? 'program link failed');
  }
  gl.useProgram(prog);

  const uResolution = gl.getUniformLocation(prog, 'u_resolution');
  const uDpr = gl.getUniformLocation(prog, 'u_dpr');
  const uInner = gl.getUniformLocation(prog, 'u_inner');
  const uOuter = gl.getUniformLocation(prog, 'u_outer');
  const uEnergy = gl.getUniformLocation(prog, 'u_energy');
  gl.uniform1f(uDpr, dpr);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, GL_PARTICLES * 4 * 4, gl.STREAM_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE); // additive glow on the dark background

  let bg: [number, number, number] = [0, 0, 0];

  return {
    setTheme(theme) {
      bg = theme.bg;
      gl.uniform3f(uInner, ...theme.inner);
      gl.uniform3f(uOuter, ...theme.outer);
    },
    draw(view, count, w, h, energy) {
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uResolution, w, h);
      gl.uniform1f(uEnergy, energy);
      gl.clearColor(bg[0], bg[1], bg[2], 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, view.subarray(0, count * 4));
      gl.drawArrays(gl.POINTS, 0, count);
    },
  };
}

/** Canvas2d fallback: fewer particles, pre-rendered gradient sprites. */
function create2dRenderer(canvas: HTMLCanvasElement): PointRenderer {
  const ctx = canvas.getContext('2d')!;
  const SPRITE = 24;

  const makeSprite = (rgb: [number, number, number]) => {
    const c = document.createElement('canvas');
    c.width = SPRITE;
    c.height = SPRITE;
    const sctx = c.getContext('2d')!;
    const g = sctx.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
    const css = `${Math.round(rgb[0] * 255)}, ${Math.round(rgb[1] * 255)}, ${Math.round(rgb[2] * 255)}`;
    g.addColorStop(0, `rgba(${css}, 0.9)`);
    g.addColorStop(1, `rgba(${css}, 0)`);
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, SPRITE, SPRITE);
    return c;
  };

  let bgCss = '#000';
  let innerSprite = makeSprite([1, 1, 1]);
  let outerSprite = makeSprite([0.3, 0.3, 0.3]);

  return {
    setTheme(theme) {
      bgCss = `rgb(${Math.round(theme.bg[0] * 255)}, ${Math.round(theme.bg[1] * 255)}, ${Math.round(theme.bg[2] * 255)})`;
      innerSprite = makeSprite(theme.inner);
      outerSprite = makeSprite(theme.outer);
    },
    draw(view, count, w, h, energy) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = bgCss;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < count; i++) {
        const o = i * 4;
        const x = view[o];
        const y = view[o + 1];
        const size = view[o + 2] * 4;
        const glow = view[o + 3];
        ctx.globalAlpha = Math.min(1, energy * (0.25 + 0.75 * glow));
        ctx.drawImage(glow > 0.5 ? innerSprite : outerSprite, x - size / 2, y - size / 2, size, size);
      }
    },
  };
}

/** Smoothed per-state orb liveliness (brightness + drift). */
function energyTarget(state: Snapshot['state']): number {
  switch (state) {
    case 'running':
      return 1;
    case 'countdown':
      return 0.85;
    case 'paused':
      return 0.45;
    case 'complete':
      return 0.3;
    default:
      return 0.6;
  }
}

export class OrbVisual implements VisualRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly sim: InstanceType<Breathe['BreathOrb']>;
  private renderer: PointRenderer;
  private readonly count: number;
  private readonly ro: ResizeObserver;
  private readonly onLost: (e: Event) => void;
  private readonly onRestored: () => void;
  private theme: Theme;
  private w: number;
  private h: number;
  private energy = 0.6;

  constructor(wasm: Breathe, canvas: HTMLCanvasElement, host: HTMLElement, theme: Theme) {
    this.canvas = canvas;
    this.theme = theme;
    const dpr = Math.min(devicePixelRatio || 1, DPR_CAP);
    this.w = Math.max(1, Math.round(host.clientWidth * dpr));
    this.h = Math.max(1, Math.round(host.clientHeight * dpr));
    canvas.width = this.w;
    canvas.height = this.h;

    let renderer: PointRenderer | null = null;
    try {
      renderer = createGlRenderer(canvas, dpr);
    } catch {
      /* fall through to canvas2d */
    }
    const usingGl = renderer !== null;
    this.renderer = renderer ?? create2dRenderer(canvas);
    this.count = usingGl ? GL_PARTICLES : FALLBACK_PARTICLES;
    this.renderer.setTheme(theme);

    this.sim = new wasm.BreathOrb(this.count, this.w, this.h, 0x9e3779b9);

    this.onLost = (e) => e.preventDefault();
    this.onRestored = () => {
      try {
        const r = createGlRenderer(canvas, dpr);
        if (r) {
          r.setTheme(this.theme);
          this.renderer = r;
        }
      } catch {
        /* keep previous renderer; worst case the canvas stays frozen */
      }
    };
    canvas.addEventListener('webglcontextlost', this.onLost);
    canvas.addEventListener('webglcontextrestored', this.onRestored);

    this.ro = new ResizeObserver(() => {
      const nw = Math.max(1, Math.round(host.clientWidth * dpr));
      const nh = Math.max(1, Math.round(host.clientHeight * dpr));
      if ((nw === this.w && nh === this.h) || nw === 0 || nh === 0) return;
      this.w = nw;
      this.h = nh;
      canvas.width = nw;
      canvas.height = nh;
      this.sim.resize(nw, nh);
    });
    this.ro.observe(host);
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    this.renderer.setTheme(theme);
  }

  frame(snap: Snapshot, dt: number): void {
    const target = energyTarget(snap.state);
    this.energy += Math.min(1.5 * dt, Math.max(-1.5 * dt, target - this.energy));

    const base = Math.min(this.w, this.h);
    const radius = base * (R_MIN + (R_MAX - R_MIN) * snap.breath);
    this.sim.step(dt, radius, snap.shimmer, this.energy);
    this.renderer.draw(
      f32View(this.sim.data_ptr(), this.count * 4),
      this.count,
      this.w,
      this.h,
      this.energy,
    );
  }

  destroy(): void {
    this.ro.disconnect();
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    this.sim.free();
  }
}
