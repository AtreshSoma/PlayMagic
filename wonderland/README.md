# Wonderland Portal

A storybook world for children, played with hands, faces, blinks and nods. It is a self-contained route at `/wonderland/`, and AETHERIA links to it through a glowing **Kids Realm** gateway.

It is plain HTML, CSS and ES modules, with no build step and no dependencies to install. Hand and face tracking use MediaPipe's Hand Landmarker and Face Landmarker. Both run inside the browser tab, and camera images are never recorded, stored or uploaded. Every control also works with touch or a mouse.

## Launch it

```bash
cd PlayMagic
python3 -m http.server 8000
```

Then open **http://localhost:8000/wonderland/**. You can also open AETHERIA at http://localhost:8000 and choose **Kids Realm** in the dock, or press **K**.

- Browsers only allow the camera on `https://` or `http://localhost`, and ES modules don't load from `file://`.
- Browsers need one real tap or click before they play sound or turn on the camera, so the first screen is one giant glowing portal: tap anywhere.
- If the camera is blocked, missing or busy, the portal shows a sleepy-camera picture and keeps working with touch and the mouse.
- `python3 -m http.server` sometimes drops connections when a page requests many modules at once. If a reload shows a blank page, reload again, or use any other static server, for example `npx serve .`.

### Fully offline

The MediaPipe library and models load from a CDN the first time. To bundle them with the portal, run this once:

```bash
bash wonderland/scripts/vendor-mediapipe.sh
```

This puts about 30 MB in `wonderland/vendor/mediapipe/`, and the portal then uses those files automatically. Until you run it, the browser console shows a harmless 404 for `vendor/mediapipe/vision_bundle.mjs`, which is the portal checking for local files. All sound is synthesised by the Web Audio API, so sound always works offline. The Fredoka font comes from Google Fonts, and rounded system fonts stand in when you're offline.

## What children do

**Home** is a calm two-column page: the world under the child's hand on the left (a living picture, its name, what it needs, simple numbered steps and a big **Play** button) and all seven worlds as picture cards on the right. Choosing is one simple step, just like the old jelly bubbles:

- **Camera hand:** rest a hand on a world and a rainbow ring fills; when it's full (1 second) the world opens. A **pinch** opens it at once.
- **Touch / mouse:** tap a world to open it (hovering the mouse previews it).
- **Keyboard:** Tab to the world list, arrows preview, Enter opens.

The header shows the camera status and a **← AETHERIA** button that returns to the main portal (mouse, touch or keyboard only, so a child's resting hand can never leave by accident). A quiet "Created by Atresh Somayajula" credit sits bottom-left.

When the child comes back Home, a hand that is still resting on a world has to move before any ring can fill, so nothing reopens by accident.

Inside the worlds, every control is a jelly bubble. Hold a hand over a bubble while a rainbow ring fills around it, **pinch** on it, or just tap it. A camera pinch counts as a tap everywhere, so it boops bunnies, launches snacks and pops music bubbles too. After a bubble fires, the hand has to leave before that bubble can fire again, so nothing repeats by accident. The **house** bubble, top-left, goes back Home (hold 1.5 seconds, or pinch).

Every world shows a star jar with a points counter beside it. Filling the jar plays a fanfare with confetti.

| World | Camera | Touch / mouse | Keys (for testing) |
|---|---|---|---|
| **Sky Painter** | Point a finger to paint. Open your palm to make the doodles come alive and swat them. Wave both hands or shake your head to clear the sky | Drag to paint. The hand bubble turns on play mode | C clears the sky |
| **Bunny Boop** (new) | Reach out and touch the bunnies and chicks as they pop up. Golden bunnies are worth 3 stars | Tap them | none needed |
| **Fruit Basket** (new) | Move your hand side to side (or tilt your head) and the basket follows. Catch the falling fruit; rainbow stars are worth 3 | Move the pointer or a finger | ←/→, A/D |
| **Hungry Monster** (new) | Touch a snack and it flies into the monster's mouth. Open your own mouth wide and the monster copies you and slurps up nearby snacks | Tap snacks. Hold the mouth bubble to slurp | 1 (hold) |
| **Firefly Hop** | Swoop a hand upward to flap. Opening your mouth, blinking or tapping work too | Tap anywhere | Space |
| **Cloud Glider** | Move your hand left or right to steer (or tilt your head). Make a fist or nod for a rainbow boost. Wave or shake your head for a star-magnet barrel roll | Pointer position steers, and the boost and spin bubbles appear | ←/→, W, S |
| **Bubble Symphony** | Pop bubbles with any fingertip. Open your mouth wide to blow bubbles. Smile to grow flowers. Raise your eyebrows to change hats | Tap bubbles. A moon buddy wears the hats, and the mouth, smile and brows bubbles do the face magic | 1 (hold), 2 (hold), 3 |

### Sky Painter tools

- **Top row**: paint colours (rainbow first).
- **Left column, brushes**: rainbow ribbon, glitter, slime, butterflies, neon tube and soap bubbles. Strokes are smoothed into flowing curves.
- **Right column**: star, heart and planet stamps, then **mirror magic** (each press steps through off → 2-way → 4-way → 6-way kaleidoscope, with faint guide lines) and **trace a picture** (sparkly dotted outlines of a star, heart, smiley, house, fish and flower; dots turn gold as you cover them, and finishing one is worth 3 stars and brings up the next).
- **Bottom-right row**: the play-mode hand, **undo** (removes the last doodle and its mirror copies), **save** (downloads the painting as a PNG with a frame and the date) and the whirlwind.
- Every finished doodle drops a star into the jar.

Each time a world opens, a glowing cloud at the bottom shows a looping picture of the move to make: a hand swooping up, a hand reaching for a bunny, a basket following a hand, a cookie flying into the monster. It disappears as soon as the child tries the move, or after 15 seconds. No world needs winking or a long-held pose.

No world can be failed. Bumping a storm cloud makes the creature giggle and bounce away, and missed rings just fade. Stars fill a jar, and each full jar plays a fanfare with confetti.

## Grown-up corner

Press and **hold** the small lock button in the bottom-right corner for 1.5 seconds. Camera hands can't press it, and quick taps don't open it. Grown-ups can also open it with the keyboard (Tab, then Enter). The panel has:

- **Sound** on/off and **Volume**.
- **Camera mirror**: how visible the child is inside the world, from 0% (hidden) to 100%. Bubble Symphony raises it to at least 60% so hats line up with the child's head, unless it's set to 0%.
- **Play with**: *Camera + touch* or *Touch / mouse only*. Touch-only turns the camera off completely.
- **Leave the portal**: a link back to the host app (see `data-exit-url` below).

Only these four settings are saved, in `localStorage` on this device.

## Integrating with another web app

**As a separate route (simplest).** Copy the `wonderland/` folder into your static or public directory, for example `public/wonderland/` in Vite, Next.js or CRA, and link to `/wonderland/`. The portal uses only relative URLs, so it works under any path.

- Set `<body data-exit-url="…">` in `wonderland/index.html` to your app's route (same origin). Remove the attribute to hide the "Leave the portal" link.
- Before navigating to the portal, stop any camera stream your app holds. Some browsers won't hand the camera to a second user. AETHERIA's `enterKidsRealm()` in `js/main.js` shows how.

**Drop-in gateway button.** `kids-realm-gateway.js` is a framework-free web component: a glowing rainbow orb that is a real link, so keyboard, screen readers and middle-click all work.

```html
<script type="module" src="/wonderland/kids-realm-gateway.js"></script>
<kids-realm-gateway href="/wonderland/" size="140"></kids-realm-gateway>
```

In React it's `<kids-realm-gateway href="/wonderland/" />` once the script is loaded.

**In an iframe.** Camera access must be delegated:

```html
<iframe src="/wonderland/" allow="camera; autoplay" style="border:0;width:100%;height:100%"></iframe>
```

## Code map

```
wonderland/
  index.html              canvas, hidden <video>, grown-up corner + panel
  css/wonderland.css      page shell and grown-up panel (the child-facing world is all canvas)
  kids-realm-gateway.js   <kids-realm-gateway> web component for host apps
  scripts/vendor-mediapipe.sh   offline install of MediaPipe files
  js/main.js              bootstrap, 60 FPS loop, render order
  js/core/                app registry + camera→screen mapping, utils (EMA, springs), settings, scene manager
  js/input/               vision (MediaPipe), hands (pose, waving), face (blink/nod/shake/expressions), pointer, input (merge)
  js/audio/sound.js       procedural Web Audio: marimba, boing, chime, pop, giggle, whoosh, fanfare, breath
  js/fx/                  glow sprite cache, pooled particles, world (sky, islands, clouds, fireflies, mirror)
  js/ui/                  jelly bubble + rainbow dwell ring, icons, characters, props (stamps, vehicles, hats),
                          coach (onboarding silhouettes), hud (tracking badges, star jar), cursors, grown-up panel, title
  js/modes/               gate, hub (Home: an accessible HTML page), painter, boop, basket, monster, firefly, glider, symphony
```

How the main pieces work:

- **One input model.** Camera hands, the mouse and each touch finger all appear in `app.input.hands` with the same shape (`x, y, tip, palm, vx, vy, pose, lm`). Face signals and keyboard stand-ins merge into `app.input.face`, and one-shot gestures (`blink`, `nod`, `shake`, `brows`, `wave`, `wipe`, `home`) arrive in `app.input.events`. Because of this, every mode works without a camera.
- **Tracking tuned for kids.**
  - An adaptive EMA (`Smooth2`) smooths heavily at rest and lightly in fast motion, and cursors are interpolated to 60 FPS between ~30 FPS camera frames.
  - A "reach gain" of 1.32× expands small arm movements to cover the whole screen.
  - Finger-extension thresholds are generous, pose changes are debounced (50–100 ms), and a lost hand coasts for 250 ms.
  - Each expression is measured against the child's own resting face, using a slow lower-envelope baseline per blendshape. Head angles calibrate during the first second the face is seen, then drift slowly back toward neutral.
- **A new mode is one class** with `enter / update / draw / drawTop`, registered in `main.js`. Use `Bubble` for controls and call `app.coach.show([...])` and `app.coach.tried(kind)` for onboarding.
- **Performance.** Glows are pre-rendered sprites drawn with `lighter` blending instead of `shadowBlur`. Particles use a structure-of-arrays pool. Painter strokes are baked once into small offscreen canvases. MediaPipe runs only on new video frames and alternates the face and hand models when inference gets slow. In headless Chrome with a fake camera, it measured 59 FPS with both models running.
- **Debugging.** `window.wonderland` exposes the live app. For example, `wonderland.scenes.go('glider')`.
