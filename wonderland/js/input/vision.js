// ---------------------------------------------------------------------------
// MediaPipe Tasks Vision: camera stream + Hand Landmarker + Face Landmarker.
//
// PRIVACY: every frame is processed inside this browser tab (WebAssembly /
// WebGL). No image, landmark or result is ever sent anywhere.
//
// The library and models are loaded from ./vendor/mediapipe/ when present
// (run scripts/vendor-mediapipe.sh once for a fully offline install), and
// otherwise from the public CDN. Only the code/model files are downloaded;
// camera data never leaves the device either way.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';

const VERSION = '0.10.14';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const MODELS = 'https://storage.googleapis.com/mediapipe-models';
const REMOTE = {
  lib: `${CDN}/vision_bundle.mjs`,
  wasm: `${CDN}/wasm`,
  hand: `${MODELS}/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
  face: `${MODELS}/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
};

export class VisionError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function cameraError(err) {
  const n = err && err.name;
  if (n === 'NotAllowedError' || n === 'SecurityError') return new VisionError('denied', 'Camera permission was declined.');
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return new VisionError('missing', 'No camera was found.');
  if (n === 'NotReadableError' || n === 'AbortError') return new VisionError('busy', 'The camera is being used by another app.');
  return new VisionError('unknown', `The camera could not start (${n || err}).`);
}

/** Prefer self-hosted files in ./vendor/mediapipe/ when they exist. */
async function resolveSources() {
  const base = new URL('../../vendor/mediapipe/', import.meta.url).href;
  try {
    const r = await fetch(base + 'vision_bundle.mjs', { method: 'HEAD', cache: 'no-store' });
    const type = r.headers.get('content-type') || '';
    if (r.ok && /javascript|ecmascript|octet/.test(type)) {
      return { lib: base + 'vision_bundle.mjs', wasm: base + 'wasm', hand: base + 'hand_landmarker.task', face: base + 'face_landmarker.task', local: true };
    }
  } catch { /* not vendored */ }
  return { ...REMOTE, local: false };
}

export class Vision {
  constructor(video) {
    this.video = video;
    this.hands = null; this.face = null;
    this.ready = false;
    this.handResult = null; this.faceResult = null;
    this.handStamp = 0; this.faceStamp = 0;
    this.lastVideoTime = -1; this.lastTs = 0; this.lastRun = 0;
    this.cost = 10; this.toggle = 0;
    this.stream = null;
  }

  /**
   * Opens the camera first (so the mirror appears right away), then loads
   * the models. `onStage('mirror' | 'models')` reports progress.
   */
  async start(onStage = () => {}) {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
      throw new VisionError('insecure', 'The camera needs https:// or http://localhost.');

    const srcP = resolveSources();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 60 } },
        audio: false,
      });
    } catch (e) { throw cameraError(e); }

    const v = this.video;
    v.srcObject = this.stream;
    await v.play().catch(() => {});
    await new Promise((res) => {
      if (v.readyState >= 2) return res();
      v.onloadeddata = () => res();
      setTimeout(res, 3000);
    });
    app.video = { w: v.videoWidth || 1280, h: v.videoHeight || 720 };
    onStage('mirror');

    const src = await srcP;
    let mod;
    try { mod = await import(/* @vite-ignore */ src.lib); }
    catch { throw new VisionError('offline', 'The hand and face helpers could not be loaded (offline?).'); }
    const lib = mod.FilesetResolver ? mod : mod.default;
    onStage('models');

    const fileset = await lib.FilesetResolver.forVisionTasks(src.wasm);
    const make = async (Task, opts) => {
      try { return await Task.createFromOptions(fileset, { ...opts, baseOptions: { ...opts.baseOptions, delegate: 'GPU' } }); }
      catch { return Task.createFromOptions(fileset, { ...opts, baseOptions: { ...opts.baseOptions, delegate: 'CPU' } }); }
    };
    // Kid-tuned: slightly lower confidences so small hands are picked up quickly.
    this.hands = await make(lib.HandLandmarker, {
      baseOptions: { modelAssetPath: src.hand }, runningMode: 'VIDEO', numHands: 2,
      minHandDetectionConfidence: 0.45, minHandPresenceConfidence: 0.45, minTrackingConfidence: 0.45,
    });
    this.face = await make(lib.FaceLandmarker, {
      baseOptions: { modelAssetPath: src.face }, runningMode: 'VIDEO', numFaces: 1,
      outputFaceBlendshapes: true, outputFacialTransformationMatrixes: false,
      minFaceDetectionConfidence: 0.45, minFacePresenceConfidence: 0.45, minTrackingConfidence: 0.45,
    });
    this.ready = true;
  }

  /**
   * Runs inference only when the camera delivered a new frame. If inference
   * gets expensive, the face model alternates frames with the hand model so
   * rendering stays at 60 FPS.
   */
  tick(now) {
    if (!this.ready) return;
    const v = this.video;
    if (v.readyState < 2 || v.currentTime === this.lastVideoTime) return;
    if (now - this.lastRun < Math.max(0, this.cost * 1.2 - 16)) return;
    this.lastRun = now;
    this.lastVideoTime = v.currentTime;
    const ts = Math.max(now, this.lastTs + 1);
    this.lastTs = ts;
    const t0 = performance.now();
    try {
      this.toggle ^= 1;
      const heavy = this.cost > 20;
      if (!heavy || this.toggle) { this.handResult = this.hands.detectForVideo(v, ts); this.handStamp = ts; }
      if (!heavy || !this.toggle) { this.faceResult = this.face.detectForVideo(v, ts); this.faceStamp = ts; }
    } catch (e) {
      console.warn('[Wonderland] inference error', e);
    }
    this.cost += (performance.now() - t0 - this.cost) * 0.1;
  }

  stop() {
    this.ready = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
    try { this.hands?.close(); this.face?.close(); } catch { /* ignore */ }
  }
}
