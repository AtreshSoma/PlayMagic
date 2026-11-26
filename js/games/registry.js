// ---------------------------------------------------------------------------
// Game registry. Joins the catalog metadata (games/catalog.js) to the game
// classes. To add an experience: write a GameBase subclass, add a catalog
// entry, and map its id here. main.js registers every entry as a scene and
// the hub builds its cards from the catalog automatically.
// ---------------------------------------------------------------------------
import { CATALOG } from './catalog.js';
import { WeaverGame } from './weaver.js';
import { SliceGame } from './slice.js';
import { RailsGame } from './rails.js';
import { KingdomGame } from './kingdom.js';
import { RallyGame } from './rally.js';
import { KeeperGame } from './keeper.js';
import { RunnerGame } from './runner.js';
import { BeatGame } from './beat.js';
import { LightMirrorGame } from './lightmirror.js';
import { GestureGateGame } from './gesturegate.js';
import { OrchestraGame } from './orchestra.js';
import { SculptorGame } from './sculptor.js';
import { StarCatcherGame } from './starcatcher.js';

const CLASSES = {
  weaver: WeaverGame,
  slice: SliceGame,
  rails: RailsGame,
  kingdom: KingdomGame,
  rally: RallyGame,
  keeper: KeeperGame,
  runner: RunnerGame,
  beat: BeatGame,
  lightmirror: LightMirrorGame,
  gate: GestureGateGame,
  orchestra: OrchestraGame,
  sculptor: SculptorGame,
  starcatcher: StarCatcherGame,
};

/** [{ ...catalogEntry, create: () => scene }] in hub order. */
export const REGISTRY = CATALOG.filter((g) => CLASSES[g.id]).map((g) => ({ ...g, create: () => new CLASSES[g.id]() }));
