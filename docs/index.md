# simscope

Record, browse, curate, and ship robot simulation rollouts from MuJoCo and
Isaac Lab 3.0+.

1. **Record** a rollout from your simulator into a compact folder format
   ([format spec](specs/2026-09-30-simscope-format-v1.md)).
2. **Serve** the folder with `simscope serve DIR`. The browser app has its own
   three.js player (orthographic camera, smooth follow, contacts), a timeline
   with automatic highlights, compare, and curation. It scales to thousands
   of envs.
3. **Export** runs with `simscope export --ui lean|full` as one offline HTML
   file, and embed them in mkdeck slides.

The design is in the [viewer v3 spec](specs/2026-09-30-simscope-viewer-v3.md)
and the [proposal](specs/2026-09-30-simscope-proposal.md), which records every
decision. Start with the [getting started guide](getting-started.md).
