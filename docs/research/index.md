# Related-work research

Five parallel research tracks surveyed the web, GitHub, and PyPI on
2026-09-29/30. Each report cites primary sources and marks anything it could
not check as UNVERIFIED. The reports are raw inputs to the
[project proposal](../specs/2026-09-30-simscope-proposal.md). They are not
decisions.

| Report | Question it answers |
| --- | --- |
| [Viser and its ecosystem](viser.md) | What can viser 1.1.x do for recording, playback, offline HTML, and annotation UI? Who builds on it? |
| [Simulators and scene extraction](simulators.md) | How do MuJoCo, MJX, MuJoCo Warp, Isaac Sim, Isaac Lab, Newton, and others expose scenes and per-frame state? |
| [Logging, curation, and annotation platforms](platforms.md) | What do Rerun, Foxglove, FiftyOne, LeRobot, CVAT, and preference tools do, and what should we copy? |
| [Storage, content addressing, and serving](storage.md) | Which on-disk format, codec, and serving design keep a large library fast and small? |
| [Offline HTML export and deck embedding](html-export.md) | How do we ship a CDN-free single file that works inside mkdeck? |
| [Spike: timeline inside Viser](spike-viser-timeline.md) | Phase 0 spike (a): can Viser's GUI carry browsing and a usable annotation timeline (decision D3)? |

The measured numbers come from Chrome 152 on Apple silicon, MuJoCo 3.14.0,
and viser 1.1.1. The research did not test Firefox, Safari, or a real Isaac
stage.
