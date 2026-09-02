# Tutorial and gameplay video

Everything here is generated from the local harness (`/dev`), so the footage is reproducible from a seed.

| Step | Command | Needs |
|---|---|---|
| Narration scripts | `video/scripts/tutorial.md`, `video/scripts/gameplay-example.md` | hand-written |
| Record shots | `npm run video:record` | web dev server on :5173 (`cd web && npm run dev`), Playwright (`npx playwright install chromium`), ffmpeg |
| Title cards | `npm run video:cards` | Playwright |
| Narration | `LUDO_API_KEY=… npm run video:narrate` (add `-- --voice "Wise woman"` to change the voice) | Ludo.ai key, ≤100 words per line |
| Stitch | `npm run video:stitch` | ffmpeg |

Outputs land in `video/out/` (git-ignored): `shots/NN-*.mp4`, `narration/NN.mp3` + `manifest.json`, `cards/*.png`, `first-cut.mp4`.

`scripts/record-demo.ts` opens `http://localhost:5173/dev?seed=28&seats=5&clean` at 1920×1080 and records one clip per shot
(hand + hover preview, drag-and-drop placement, the scene-by-scene reveal, a staged funeral, the end screen).
`scripts/stitch.py` pairs each narration line with a clip (see `MAP` in the file), holds the last frame when the clip is shorter
than the line, and concatenates everything with title and end cards.

To re-record with a different table, change `--seed`/`--seats`; to change wording, edit the markdown table and re-run
`video:narrate` (already-generated lines are skipped) and `video:stitch`.
