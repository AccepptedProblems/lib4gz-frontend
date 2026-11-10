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

export function hasWebGL(scene: Phaser.Scene): boolean {
  const renderer = scene.sys.game.renderer as { type?: number } | null | undefined;
  return !!renderer && renderer.type === Phaser.WEBGL;
}

const FRAG = `
precision mediump float;
uniform vec2 resolution;
uniform sampler2D iChannel0;
uniform vec2 camPos;
uniform float camYaw;
uniform float camHeight;
uniform float camPitch;
uniform float tanHalfFov;
uniform vec2 texOrigin;
uniform vec2 texSize;
uniform vec3 skyColor;
uniform vec3 grassColor;
uniform vec2 fog;
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
    gl_FragColor = vec4(skyColor, 1.0);
    return;
  }
  float t = camHeight / -ray.z;
  vec2 world = camPos + ray.xy * t;
  vec2 tuv = (world - texOrigin) / texSize;
  vec3 ground = grassColor;
  if (tuv.x >= 0.0 && tuv.x <= 1.0 && tuv.y >= 0.0 && tuv.y <= 1.0) {
    ground = texture2D(iChannel0, tuv).rgb;
  }
  float haze = smoothstep(fog.x, fog.y, t);
  gl_FragColor = vec4(mix(ground, skyColor, haze), 1.0);
}
`;

function rgb(colour: number): { x: number; y: number; z: number } {
  return { x: ((colour >> 16) & 255) / 255, y: ((colour >> 8) & 255) / 255, z: (colour & 255) / 255 };
}

/**
 * The mode 7 view: one full-stage shader samples the track texture through a perspective
 * ground-plane transform, and `project` puts sprites on the same ground. WebGL only; check
 * `hasWebGL` before constructing one.
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
      skyColor: { type: '3f', value: rgb(UI.road.sky) },
      grassColor: { type: '3f', value: rgb(UI.road.ground[0]) },
      fog: { type: '2f', value: { x: C.camera.fogNear, y: C.camera.fogFar } },
    });
    this.shader = scene.add.shader(base, SW / 2, SH / 2, SW, SH);
    this.shader.setChannel0(texture.key, { wrapS: 'clamp_to_edge', wrapT: 'clamp_to_edge', minFilter: 'linear', magFilter: 'linear' });
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
