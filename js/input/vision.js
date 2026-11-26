// ---------------------------------------------------------------------------
// MediaPipe Tasks Vision wrapper: camera stream + Face Landmarker (with
// blendshapes) + Hand Landmarker. Inference is throttled to new video frames
// and adapts to its own cost so rendering stays at 60 FPS.
// ---------------------------------------------------------------------------
import { mapper } from './mapper.js';

const VERSION = '0.10.14';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export class VisionError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

/** Translate getUserMedia failures into gentle, actionable language. */
function describeCameraError(err) {
  const name = err && err.name;
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return new VisionError('denied', 'Camera permission was declined. The mirror stays dark, so you can weave with mouse and keys instead.');
  if (name === 'NotFoundError' || name === 'OverconstrainedError')
    return new VisionError('missing', 'No camera was found, so mouse and keys will carry your magic instead.');
  if (name === 'NotReadableError' || name === 'AbortError')
    return new VisionError('busy', 'Another app is using the camera. Close it and reload, or keep weaving with mouse and keys.');
  return new VisionError('unknown', `The mirror could not open (${name || err}). Mouse and keys will do for now.`);
}

export class Vision {
  constructor(video) {
    this.video = video;
    this.face = null; this.hands = null;
    this.ready = false;
    this.faceResult = null; this.handResult = null;
    this.faceStamp = 0; this.handStamp = 0;
    this.lastVideoTime = -1; this.lastTs = 0;
    this.cost = 8; this.frameToggle = 0;
  }

  async start(onStatus = () => {}) {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
      throw new VisionError('insecure', 'The camera only works over https:// or http://localhost. Serve the folder locally to open the mirror.');

    onStatus('Opening the mirror…');
    const streamP = navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 60 } },
      audio: false,
    }).catch((e) => { throw describeCameraError(e); });

    // Models survive a camera off/on toggle, so turning it back on is quick.
    const libP = this.hands && this.face ? Promise.resolve(null) : import(/* @vite-ignore */ `${CDN}/vision_bundle.mjs`).catch(() => {
      throw new VisionError('offline', 'The vision runes could not be fetched (are you offline?). Mouse and keys will carry your magic.');
    });

    const [stream, mod] = await Promise.all([streamP, libP]);
    this.video.srcObject = stream;
    await this.video.play().catch(() => {});
    await new Promise((res) => {
      if (this.video.readyState >= 2) return res();
      this.video.onloadeddata = () => res();
      setTimeout(res, 3000);
    });
    mapper.setVideo(this.video.videoWidth, this.video.videoHeight);
    this.stream = stream;
    if (this.hands && this.face) { this.lastVideoTime = -1; this.ready = true; onStatus('The mirror is awake.'); return; }
    const lib = mod.FilesetResolver ? mod : mod.default;

    onStatus('Awakening the hand-spirits…');
    const fileset = await lib.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
    const make = async (Task, opts) => {
      try { return await Task.createFromOptions(fileset, { ...opts, baseOptions: { ...opts.baseOptions, delegate: 'GPU' } }); }
      catch { return Task.createFromOptions(fileset, { ...opts, baseOptions: { ...opts.baseOptions, delegate: 'CPU' } }); }
    };
    this.hands = await make(lib.HandLandmarker, {
      baseOptions: { modelAssetPath: HAND_MODEL }, runningMode: 'VIDEO', numHands: 2,
      minHandDetectionConfidence: 0.55, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
    });
    onStatus('Reading the lines of your face…');
    this.face = await make(lib.FaceLandmarker, {
      baseOptions: { modelAssetPath: FACE_MODEL }, runningMode: 'VIDEO', numFaces: 1,
      outputFaceBlendshapes: true, outputFacialTransformationMatrixes: false,
      minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
    });
    this.stream = stream;
    this.ready = true;
    onStatus('The mirror is awake.');
  }

  /**
   * Called every animation frame. Runs inference only when the camera has a
   * new frame. Hands run on every new frame; the face runs every frame too
   * unless the combined cost is high, in which case it alternates.
   */
  tick(now) {
    if (!this.ready) return;
    const v = this.video;
    if (v.readyState < 2 || v.currentTime === this.lastVideoTime) return;
    // On slow devices, leave room for render frames between inferences.
    if (now - (this.lastRun || 0) < Math.max(0, this.cost * 1.25 - 16)) return;
    this.lastRun = now;
    this.lastVideoTime = v.currentTime;
    const ts = Math.max(now, this.lastTs + 1); // timestamps must strictly increase
    this.lastTs = ts;
    const t0 = performance.now();
    try {
      this.handResult = this.hands.detectForVideo(v, ts);
      this.handStamp = ts;
      this.frameToggle ^= 1;
      if (this.cost < 18 || this.frameToggle) {
        this.faceResult = this.face.detectForVideo(v, ts);
        this.faceStamp = ts;
      }
    } catch (e) {
      console.warn('[Aetheria] inference error', e);
    }
    this.cost += (performance.now() - t0 - this.cost) * 0.1;
  }

  stop() {
    this.ready = false;
    this.stream?.getTracks().forEach((t) => t.stop());
  }
}
