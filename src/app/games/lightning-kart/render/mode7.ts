import Phaser from 'phaser';
import { C } from '../engine/constants';
import { Vec } from '../track/geometry';
import { TrackTexture } from './track-texture';

/** The eye: a point over the ground, a heading, a height and a pitch down from level. */
export interface Mode7Camera {
  x: number;
  y: number;
  yaw: number;
  height: number;
  pitch: number;
  fovDeg: number;
}

export interface Projected {
  x: number;
  y: number;
  /** Screen pixels per world unit at that depth. */
  scale: number;
  depth: number;
}

const UI = C.ui;
const SW = UI.stage.w;
const SH = UI.stage.h;

/** What a scene shows when it cannot draw the race. */
export const NO_WEBGL = 'Lightning Kart needs WebGL in this browser';

/**
 * The game's renderer: `webgl` draws the race; `canvas` is Phaser's fallback in a browser
 * without WebGL, where no race is dealt; `headless` is the specs' game only, which draws
 * nothing but still deals and races.
 */
export function renderMode(scene: Phaser.Scene): 'webgl' | 'canvas' | 'headless' {
  const type = scene.sys.game.config.renderType;
  return type === Phaser.WEBGL ? 'webgl' : type === Phaser.CANVAS ? 'canvas' : 'headless';
}

export function hasWebGL(scene: Phaser.Scene): boolean {
  return renderMode(scene) === 'webgl';
}

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float; // world coordinates run to hundreds of units: a 16-bit mediump would step the far road
#else
precision mediump float;
#endif
uniform vec2 resolution;
uniform sampler2D iChannel0;
uniform vec2 camPos;
uniform float camYaw;
uniform float camHeight;
uniform float camPitch;
uniform float tanHalfFov;
uniform vec2 texOrigin;
uniform vec2 texSize;
uniform vec3 skyTop;
uniform vec3 skyMid;
uniform vec3 horizon;
uniform vec3 groundColor;
uniform vec2 fog;
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform vec2 sunSize;
uniform float sunGlow;
varying vec2 fragCoord;

void main() {
  vec2 uv = fragCoord / resolution;
  float nx = (uv.x * 2.0 - 1.0) * tanHalfFov * (resolution.x / resolution.y);
  float ny = (uv.y * 2.0 - 1.0) * tanHalfFov;
  float cp = cos(camPitch);
  float sp = sin(camPitch);
  float cy = cos(camYaw);
  float sy = sin(camYaw);
  vec3 f = vec3(cy * cp, sy * cp, -sp);
  vec3 r = vec3(-sy, cy, 0.0);
  vec3 u = vec3(cy * sp, sy * sp, cp);
  vec3 ray = f + r * nx + u * ny;
  if (ray.z >= -0.0005) {
    // Sky: the row's height above the horizon row, as a fraction of the sky on screen, picks
    // the gradient stop; the sun is a soft disc where the ray runs near the sun's direction
    // (chord distance between unit vectors, which mediump resolves where a dot near 1 cannot).
    float horizonNy = sp / cp;
    float e = clamp((ny - horizonNy) / max(tanHalfFov - horizonNy, 0.001), 0.0, 1.0);
    vec3 sky = e < 0.45 ? mix(horizon, skyMid, e / 0.45) : mix(skyMid, skyTop, (e - 0.45) / 0.55);
    float a = length(normalize(ray) - sunDir);
    float disc = 1.0 - smoothstep(sunSize.x, sunSize.x * 1.15, a);
    float glow = (1.0 - smoothstep(0.0, sunSize.y, a)) * sunGlow;
    gl_FragColor = vec4(mix(sky, sunColor, clamp(disc + glow, 0.0, 1.0)), 1.0);
    return;
  }
  float t = camHeight / -ray.z;
  vec2 world = camPos + ray.xy * t;
  vec2 tuv = (world - texOrigin) / texSize;
  vec3 ground = groundColor;
  if (tuv.x >= 0.0 && tuv.x <= 1.0 && tuv.y >= 0.0 && tuv.y <= 1.0) {
    ground = texture2D(iChannel0, tuv).rgb;
  }
  float haze = smoothstep(fog.x, fog.y, t);
  gl_FragColor = vec4(mix(ground, horizon, haze), 1.0);
}
`;

/**
 * Anisotropic sampling on the track texture, where the browser has the extension (nearly
 * all do): the ground is minified far more along the view than across it, and the mipmap
 * level alone, picked for the steeper axis, smears the far stripe sideways. The parameter
 * sits on the GL texture object, so every view on the same texture sets it again.
 */
function anisotropic(scene: Phaser.Scene, key: string, amount: number): void {
  const renderer = scene.sys.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
  const gl = renderer.gl as WebGLRenderingContext | undefined;
  if (!gl) return; // the Canvas renderer has no GL
  const ext = gl.getExtension('EXT_texture_filter_anisotropic');
  const wrapper = scene.textures.get(key).source[0]?.glTexture;
  if (!ext || !wrapper?.webGLTexture) return;
  const max = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number;
  const bound = gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture | null;
  gl.bindTexture(gl.TEXTURE_2D, wrapper.webGLTexture);
  gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(amount, max));
  gl.bindTexture(gl.TEXTURE_2D, bound);
}

/** The chord between two unit vectors `deg` apart; the shader measures the sun with it. */
function chord(deg: number): number {
  return 2 * Math.sin((deg * Math.PI) / 360);
}

function rgb(colour: number): { x: number; y: number; z: number } {
  return { x: ((colour >> 16) & 255) / 255, y: ((colour >> 8) & 255) / 255, z: (colour & 255) / 255 };
}

/** The sun as a unit vector in world space: `sunAzimuthDeg` is a heading, `sunElevationDeg` is up. */
function sunDirection(): { x: number; y: number; z: number } {
  const az = (UI.road.sunAzimuthDeg * Math.PI) / 180;
  const el = (UI.road.sunElevationDeg * Math.PI) / 180;
  return { x: Math.cos(az) * Math.cos(el), y: Math.sin(az) * Math.cos(el), z: Math.sin(el) };
}

/**
 * The mode 7 view: one full-stage shader samples the track texture through a perspective
 * ground-plane transform, draws the sunset sky with its sun above the horizon, and `project`
 * puts sprites on the same ground. WebGL only; check `hasWebGL` before constructing one.
 */
export class Mode7View {
  readonly shader: Phaser.GameObjects.Shader;
  private cam: Mode7Camera = { x: 0, y: 0, yaw: 0, height: C.camera.height, pitch: (C.camera.pitchDeg * Math.PI) / 180, fovDeg: C.camera.fovDeg };

  constructor(scene: Phaser.Scene, texture: TrackTexture) {
    const base = new Phaser.Display.BaseShader('mode7', FRAG, undefined, {
      camPos: { type: '2f', value: { x: 0, y: 0 } },
      camYaw: { type: '1f', value: 0 },
      camHeight: { type: '1f', value: C.camera.height },
      camPitch: { type: '1f', value: 0 },
      tanHalfFov: { type: '1f', value: 1 },
      texOrigin: { type: '2f', value: { x: texture.originX, y: texture.originY } },
      texSize: { type: '2f', value: { x: texture.worldW, y: texture.worldH } },
      skyTop: { type: '3f', value: rgb(UI.colors.sunset[0]) },
      skyMid: { type: '3f', value: rgb(UI.colors.sunset[1]) },
      horizon: { type: '3f', value: rgb(UI.colors.sunset[2]) },
      groundColor: { type: '3f', value: rgb(UI.road.ground[0]) },
      fog: { type: '2f', value: { x: C.camera.fogNear, y: C.camera.fogFar } },
      sunDir: { type: '3f', value: sunDirection() },
      sunColor: { type: '3f', value: rgb(UI.colors.yellow) },
      sunSize: { type: '2f', value: { x: chord(UI.road.sunRadiusDeg), y: chord(UI.road.sunGlowDeg) } },
      sunGlow: { type: '1f', value: UI.road.sunGlowAlpha },
    });
    this.shader = scene.add.shader(base, SW / 2, SH / 2, SW, SH);
    // Far away the ground is minified several texels per pixel, and one-texel lines (the paving,
    // the stripe's core) alias into speckle that flickers in motion; the mipmap filter averages
    // them away. The track canvas is a power of two so Phaser generates the mipmaps on upload.
    this.shader.setChannel0(texture.key, { wrapS: 'clamp_to_edge', wrapT: 'clamp_to_edge', minFilter: 'linear_mipmap_linear', magFilter: 'linear' });
    anisotropic(scene, texture.key, UI.road.anisotropy);
    this.setCamera(this.cam);
  }

  setCamera(cam: Mode7Camera): void {
    this.cam = { ...cam };
    const s = this.shader;
    s.setUniform('camPos.value.x', cam.x);
    s.setUniform('camPos.value.y', cam.y);
    s.setUniform('camYaw.value', cam.yaw);
    s.setUniform('camHeight.value', cam.height);
    s.setUniform('camPitch.value', cam.pitch);
    s.setUniform('tanHalfFov.value', Math.tan((cam.fovDeg * Math.PI) / 360));
  }

  /** Screen position and scale of a ground point, or null when it is behind the eye. */
  project(p: Vec): Projected | null {
    return projectToScreen(p, this.cam);
  }

  destroy(): void {
    this.shader.destroy();
  }
}

export function projectToScreen(p: Vec, cam: Mode7Camera): Projected | null {
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const qx = p.x - cam.x;
  const qy = p.y - cam.y;
  const qz = -cam.height;
  const depth = qx * cy * cp + qy * sy * cp + qz * -sp;
  if (depth < C.camera.near) return null;
  const xc = qx * -sy + qy * cy;
  const yc = qx * cy * sp + qy * sy * sp + qz * cp;
  const tanHalf = Math.tan((cam.fovDeg * Math.PI) / 360);
  const focal = SH / 2 / tanHalf;
  return { x: SW / 2 + (xc / depth) * focal, y: SH / 2 - (yc / depth) * focal, scale: focal / depth, depth };
}
