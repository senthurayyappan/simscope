# Design

simscope records rollouts from MuJoCo and Isaac Lab, opens a folder of them, and writes one HTML file that plays offline.

## Why

A rollout review needs the recording, the folder, and a file you can hand to someone else. Those three were split across separate viewers and file formats, and the viewers drifted apart. simscope is the one library for all three.

## The gap

Rerun is the closest existing tool. It does not take annotations, and its viewer is about 50 MB, so it does not produce a small standalone file. A viewer driven from Python also cannot follow a body smoothly: the camera arrives after the body moves. simscope keeps the player in the browser, next to the poses, and uses that same player for the live folder and the offline file.

## Decisions

These are the choices that still hold. Change one here, and say why.

- The quaternion order is xyzw. Only the MuJoCo adapter converts.
- The library stores lossless float blocks. An export quantizes poses. Pose blocks use deflate, which a browser decodes on its own.
- Meshes and scenes are stored once, by content hash, and shared across rollouts.
- Notes, ratings, and labels sit in a JSON file next to each rollout. The SQLite index is a cache and can be rebuilt.
- The simulators are MuJoCo, including MJX and MuJoCo Warp, and Isaac Lab 3.0 or newer. Python is 3.12 or newer.
- Import reads `.rbundle` files and self-contained Brax HTML pages. Export writes one HTML file or a `.simscope` pack.
- The viewer is this repository's three.js player. Python serves the folder over HTTP.
- Follow runs in the browser, in the same frame as the poses.
- A rollout with many envs draws the ones you are looking at in full and the rest as simple shapes.
- Built-in timeline markers are net contact force and center-of-mass acceleration. Any other marker is registered in Python or placed by hand.
- A rollout that is still recording is read from the finished blocks on disk. The recorder does not open a connection to the viewer.
- Contact forces are a stream the simulator adapter records. The viewer draws them as arrows.
- The window has three regions: the library, the viewport, and the inspector, with the timeline along the bottom. Colour identifies a rollout or a marker.
