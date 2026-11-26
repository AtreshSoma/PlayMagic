# AETHERIA · The Living Tapestry

AETHERIA turns your webcam into a magical interface you control through gestures. The only controls are your **eyes, hands and face**. There are no buttons to click.

It is pure HTML, CSS and ES modules, with no build step and no dependencies to install. The MediaPipe vision models stream from a CDN the first time you open the mirror. Camera frames never leave your device.

## Run it

```bash
cd PlayMagic
npx serve .                        # or: python3 -m http.server 8000
```

`python3 -m http.server` sometimes drops connections when the page loads its ~60 modules at once. If a reload shows only the background, reload again or use `npx serve`.

Open **http://localhost:8000** in a current Chrome, Edge, Firefox or Safari. Use Chrome or Edge for the best GPU inference.

- Browsers only allow the camera over `https://` or `http://localhost`, and ES modules don't load from `file://`. The page explains this if you open it directly.
- Click the **sigil** to start with the camera, or the **mouse orb** below it to play without one. Browsers need this one real click before sound can play.
- If camera permission is denied, no camera is found, it's in use, or you're offline, AETHERIA explains why and switches to mouse mode automatically.

## How it works

1. **Start**: click the sigil to use your camera, or the small orb below it to use the mouse.
2. **15-second tutorial** (first visit only): touch three stars, grab and release an orb, then smile.
3. **Home**: a calm two-column page. On the left, the game under your pointer: what it needs the camera to see, numbered steps (for your current input, with the other input's controls below), your best score and a **Play** button. On the right, filters (All games · Motion · Arcade · Puzzle & reflex · Create) and a list of every game. Selection is **one simple step**, like Wonderland's bubbles: point at a game and hold still, and a ring fills around its icon; when it's full (1.2 s) the game starts. **Pinch** it (either hand), **click** or **tap** it to start at once. Keyboard: arrows preview, Enter starts. Moving away cancels the ring, and when you come back Home the hand must move to a game before a ring can fill. Only the game cards and Play fill by resting; filters and the camera button need a pinch or click. Nods, winks, thumbs-ups and swipes do nothing on Home.

### Vision-style controls

Modelled on visionOS: your pointer **snaps magnetically** to the nearest button or game, which lights up with a soft hover glow. **Pinch anywhere, with either hand**, to press what's in focus, so your pointing hand never has to hold perfectly still. Focus stays locked on the target while your fingers close (closing them slides the cursor toward the pinch point), and a pinch counts as a tap as long as your palm stays roughly still, so ordinary hand jitter never turns a pinch into a drag. Pinch detection accepts a natural thumb-to-index pinch with the index curled; only an index folded deep into the palm (a fist) is ignored. **Pinch and drag** scrolls. **Two-hand pinch** zooms the sky.

### The interface

- **Home button** (top-left, in every game and the tutorial): click or tap it, Tab + Enter, or pinch it. During live play a camera hand must pinch-**hold** it for half a second (a ring fills), so a stray pinch never ends a round. Lives sit top-right.
- **Creator credit**: a quiet "Created by Atresh Somayajula" signature in a script face sits in the bottom-left of Home (and of Wonderland's Home).
- **Floating dock** (bottom centre): Home, Spellbook, Leaderboard, Settings, **How to play**, camera on/off, sound, Kids Realm.
- **How to play** (dock **?** button, or the **?** key): the basics, every easy gesture with its keyboard twin, and each game's controls. It opens by itself the first time you reach Home. It rests dimmed and wakes as your hand or mouse comes near. During a game, hands must *pinch-hold* a dock button so a stray pinch never quits a round. Tab + Enter work for keyboard users.
- **Gesture status pill** (top centre): two dots show whether the camera sees a hand and a face, and the label lights up with the gesture recognised right now ("Pinch", "Peace", "Left Wink", "Head Tilt").
- **3-second onboarding**: every game opens with looping animated pictures of the moves (plus keycaps for keyboard players), and no text to read. Pinch, click, thumbs up, nod or Enter starts at once.
- **Camera toggle**: turn the camera off or on at any time from the dock. Everything keeps working with the mouse, keys and touch.

### The only controls you need

| | With the camera | With the mouse |
|---|---|---|
| Move | Point one finger at the screen | Move the mouse |
| Choose | Pinch thumb and finger together | Click |
| Let go | Open your hand | Release the click |
| Go back | Pinch the **Home** button, top-left (hold it during live play), or **Home** in the dock, or shake your head on a results screen | Click it, or press Esc |
| Confirm (play again) | Thumbs up | Enter or T |

### Magic to discover

Everything else is a magic you find by trying it. The coach suggests the next one, a "New magic discovered" card celebrates each find, and the **Spellbook** tracks all nineteen:

Spark (pinch) · Scatter (open hand) · Golden Bloom (smile) · Levitation (raise brows) · Stardust Breath (open mouth) · Bend Gravity (tilt head) · Shift Element (fast sideways swipe) · Shield / Prism / Vortex Runes (point one finger, wait for the ring, then draw a circle, triangle or spiral), plus:

| Gesture | What it does | Keys |
|---|---|---|
| **Fist, held** | Gravity Well: light spirals into your hand | hold F |
| **Peace sign** | Freeze Frame: time freezes and a snapshot is taken (pinch/click the thumbnail to save it) | P |
| **Thumbs up** | Confirm: start a game, play again | T |
| **Both palms up, apart** | Energy Barrier between your hands; light bounces off it | hold B |
| **Left / right wink** | Star Catcher lanes | Z / X |
| **Double blink** | Light Burst (and a reset in Gravity Sculptor) | Space twice |
| **Cheek puff or wide mouth, then let go** | Shockwave | hold O, release |
| **Nod / shake** | Yes / No: confirm, or close a panel / leave a results screen | Y / N |

With the mouse, face magic uses keys **1** smile, **2** open mouth, **3** raise brows and **A / D** tilt, and **H** is an open palm. Runes use **Shift + draw**, or **7 / 8 / 9**. Other keys: **G** Spellbook · **L** Leaderboard · **R** Settings · **?** How to play · **M** mute · **←/→** change element (on Home, arrows move through the game list) · **K** Kids Realm. If winks feel swapped on your camera, **Settings → Swap wink sides** fixes it.

### Games

Motion games (new):

- **Neon Rails** (full-body runner): dash along three rail lines through a neon city. **Step left/right** to switch lines and dodge trains, **jump** over low barriers, **crouch** to slide under high bars. A 1.2-second calibration learns where you stand, and a small body panel shows how the camera reads you. Collect coins (every 50 raises the multiplier), Hoverboards (shield + double score) and Coin Magnets. Without a camera: ← → ↑ ↓ / Space, or swipe with the mouse or a finger.
- **Sky Kingdom** (platformer): guide Lumo across floating sky islands to the rainbow gate. Your hand is an **air joystick** (right of centre runs right; an on-screen ring shows it), **flick up** to jump (again in the air to double jump). Stomp Grumbles, bump crystal blocks for coins, Star Seeds (grow big) and Spark Wands (✌ throws sparks). Each world gets longer. Keys: ← → run, ↑ / Space jump, P spark.
- **Nebula Rally** (kart racer): three laps against five rivals on a neon space track. Hold **both hands like a steering wheel** and turn them (the on-screen wheel turns with you). The kart accelerates by itself; pinch or ✌ uses items (Comet Boost, Star Shield, Spark). Keys: ← → steer, Space item.
- **Comet Keeper** (block and dodge): put a palm on each glowing ring as its comet lands, use both hands for golden comets, and move your head out of the way of dark meteors.

New, fast and easy to pick up:

- **Comet Slice** (slicing arcade): glowing space fruit is tossed up from below. Swipe your hand through it to slice it, several in one swipe for a combo bonus. Dark bombs cost a light; a golden comet starts a fruit frenzy. Missed fruit costs nothing. Mouse / touch: swipe the pointer.
- **Starlight Run** (lane runner): Lumo dashes down a neon space road. Move your hand left or right (or tilt your head) to change lanes, and flick your hand up or pinch to jump low beams. Collect stars, grab shields and star magnets; the road speeds up. Keys: ← → change lanes, ↑ or Space to jump.
- **Beat Bloom** (rhythm): a synthesised 104 BPM track plays while notes glide to four pads within easy reach. Touch a pad as its note lands for Perfect / Good; every hit plays the melody. Keys D F J K, or click the pads. No way to fail.

Also on Home:

- **Light Mirror**: your raised hands are mirror blades; tilt them to bounce a laser into crystal prisms. Each layout adds fixed crystals and dark absorbers. Pinch to pin a mirror. Mouse: scroll or Q/E to turn, click to pin.
- **Gesture Gate**: make the gesture on each token (open palm, peace, fist, thumbs up, smile, open mouth) before it reaches the portal. Speed adapts to the player. Without a camera, tap the pose pad or press H P F T 1 2.
- **Star Catcher**: tilt your head (or open your palm on that side, or wink) to catch stars in the left and right baskets; open your mouth wide to shield your crystal from meteors. Keys Z / X / Space, or tap a side.
- **Gravity Sculptor** (sandbox): pinch to grow planets, flick to launch them into orbit; a held fist is a black hole, a held open palm a supernova, a peace sign freezes time.
- **Cosmic Orchestra** (free play): left hand chords, right hand melody, open mouth swells the sound, nod for a beat.
- **Stardust Weaver**: pinch the falling stars and swat dark shards with an open hand.

No game needs a gesture held for long or any winking. Gaze Constellations and Echoes of the Face were retired because their controls were tiring; their code is kept in `js/games/retired/`.

Settings holds the element (Astral, Ember, Tide, Void), effect strength, mirror view (full, glowing outline or none), sound level, tutorial replay and eye re-tuning. Scores, streaks, found magic and your name and emblem are saved in the browser, and the Leaderboard can save a PNG card of your results.

## Kids Realm: Wonderland Portal

The rainbow **Kids Realm** button (top-left on the start screen, and in the dock) opens the **Wonderland Portal** at `/wonderland/`. It's a separate, self-contained storybook world for young children with seven worlds: Sky Painter, Bunny Boop, Fruit Basket, Hungry Monster, Firefly Hop, Cloud Glider and Bubble Symphony. Every control is a picture, hover-to-select takes 1 second, and a hold-to-open grown-up corner sits bottom-right. See [wonderland/README.md](wonderland/README.md) for how to play it, run it offline and add it to another app.

## Architecture

```
index.html            render stack: #tapestry (WebGL) · #mirror (video) · #fx (2D) · #hud (glass DOM)
css/aetheria.css      glassmorphism, widgets, overlays
js/main.js            bootstrap, actions (incl. camera toggle), 60 FPS frame loop, snapshot capture
js/core/              app context, utils (EMA smoothers), themes, store, celestial ephemerides
js/input/             vision engine (MediaPipe), hands (pinch/open/point/fist/peace/thumbs + wrist angle), body (full-body moves),
                      face (blendshapes, blink/wink/double blink, cheek puff, yaw/pitch → nod/shake),
                      gestures (gesture classifier: debounced events + live pose set + pill label),
                      runes, gaze, fallback (mouse/keys/touch), mood, input (merge)
js/audio/             audio.js: procedural Web Audio (pad, chimes, chords, shatter, shutter, pulse, plucks)
                      orchestra.js: continuous chord-pad and mouth-swell voices for Cosmic Orchestra
js/fx/                tapestry shader, pooled particles (+ reflective barrier), spell effects, mirror,
                      feedback, gesturefx (gravity wells, barrier, shockwave, burst, freeze), starfield
js/ui/                gesture targets, dock, gesture pill, how-to-play guide, signifiers (animated gesture glyphs), snapshot,
                      reticle, HUD/coach, discovery, spellbook, settings, leaderboard, astrolabe, icons
js/scenes/            scene/overlay managers, intro, calibration, initiation, hub (Home: an accessible HTML page, js/scenes/hub.js)
js/games/             catalog (metadata) + registry (classes), base (onboarding/HUD/results),
                      rails, kingdom, rally, keeper, slice, runner, beat, lightmirror, gesturegate,
                      orchestra, sculptor, starcatcher, weaver · lumo.js (shared mascot art)
                      (retired/ holds the old constellations and echoes games, not loaded)
js/data/              challengers, constellations
```

- **Unified input.** Camera and fallback emit the same per-frame state and the same event list, so every feature works without a camera. Scenes read `app.input.events` each frame, and pose-matching games read `app.input.gest.has('peace')` and similar.
- **Adding a game.** Write a `GameBase` subclass in `js/games/`, add its metadata to `games/catalog.js` and its class to `games/registry.js`. The Home card (give it a `group` and `needs`), scene registration and (if `scored`) leaderboard tab appear automatically. Set `cues` for the 3-second onboarding and `allow` flags to opt out of global gesture effects.
- **Smoothing.** Adaptive EMA (`Smooth2`) smooths heavily at rest and lightly in motion. Pinch and expressions use hysteresis and debounce. Expressions are baseline-corrected against your resting face.
- **Performance.** Inference runs only on new video frames and throttles itself when slow. The tapestry renders at reduced resolution. Particles are a structure-of-arrays pool with cached glow sprites. Glowing text is rendered once into cached sprites (canvas shadow blur is expensive), and game icons are pre-rendered. The hand / mouse pointer draws on its own canvas above the HTML layer, so it is never hidden behind a panel. An **adaptive quality governor** watches frame time and steps resolution and particle density between High, Balanced and Battery saver (Settings → Visual quality: Auto / High / Battery saver). Wonderland has the same governor for its canvas resolution.
- **Body motion.** `js/input/body.js` turns the face landmarks into full-body moves (lean/lane, jump, duck) against a calibrated, slowly re-centring neutral pose, so motion games need no extra model download.
- **Sky.** The sun and moon use low-precision ephemerides. Planets use JPL Keplerian elements converted to geocentric longitude, so you get the real moon phase, zodiac transits, conjunctions and retrogrades.

For debugging, `window.aetheria` exposes the live app context in devtools.

## Tips

- Light your face from the front and keep your hand about an arm's length from the camera. If the camera loses your hand, the coach tells you.
- If eye tracking feels off, use **Settings → Re-tune eye tracking**. In Gaze Constellations, holding your gaze on a star connects it after 1.5 s even without a blink.
