// Entry point of the lean bundle: registers <simscope-player> and exposes
// the API on the global `SimscopePlayer` (the bundle is one IIFE).

import * as format from "../core/format.js";
import { Clock, clockFor } from "../core/clock.js";
import { linkCameras } from "../core/compare.js";
import { startLoop, stepLoop } from "../core/loop.js";
import { Player } from "../core/player.js";
import { HttpSource, PackSource, SourceError } from "../core/source.js";
import { decodeBase64, register, SimscopePlayerElement } from "./element.js";
import { attachMaster } from "./master.js";

register();

export { attachMaster, Clock, clockFor, decodeBase64, linkCameras, format, HttpSource, PackSource, Player, register, SimscopePlayerElement, SourceError, startLoop, stepLoop };
