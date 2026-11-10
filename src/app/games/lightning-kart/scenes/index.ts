import { BootScene } from './boot';
import { DebugScene } from './debug';
import { GarageScene } from './garage';
import { HomeScene } from './home';
import { RaceScene } from './race';
import { ReadyScene } from './ready';
import { ResultScene } from './result';
import { ScopeScene } from './scope';

/** Every scene, Boot first. The host and the flow spec both build the game from this list. */
export const SCENES = [BootScene, HomeScene, GarageScene, ScopeScene, ReadyScene, RaceScene, ResultScene, DebugScene];
