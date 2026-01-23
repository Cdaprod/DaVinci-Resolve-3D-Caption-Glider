# Repository-wide AGENT Guidance

This file applies to the entire repository.

- Treat **bold** markers in transcripts or fallback text as semantic emphasis; strip the asterisks from rendered text but preserve the emphasis flag for animation logic.
- Emphasis behavior must follow the stacked rule system: normal words use the baseline animation, emphasized words apply the semantic emphasis profile, terminal (last) words apply the terminal emphasis tweaks, and bold + last words stack both.
- Default emphasis profile to keep aligned with docs/UI: `documentary` with scale 1.08, settle 260ms, semantic drift 0.08×word width, terminal drift 0.45×word width, semantic hold +120ms, terminal hold +300ms, follow multipliers 0.72 (emphasis) / 0.80 (terminal), look-at multipliers 0.75 (emphasis) / 0.85 (terminal).
- Whenever cfg defaults or emphasis/reveal presets change, update README and in-app hints in `public/index.html` to stay in sync.
- Keep changes minimal and idempotent; prefer extending existing files over introducing new ones.
- Persist any new configurable UI control into localStorage (via `captioner_state_v1`) and keep `public/localStorage.json` (and `public/alternate-test-versions/localStorage.json` when present) in sync as the seed/default override when defaults shift.
- Seed files should store `captioner_state_v1` as proper JSON objects (not double-encoded strings); normalization logic should continue to accept legacy stringified payloads but new seeds must remain clean for readability.
- Profile-token parsing must remain default-first: start in the default profile unless a `#A/#B/#C` switch is encountered. Directive-only lines switch the active profile without rendering text, and `[PAUSE=ms]` / `[HOLD=ms]` tokens should accumulate onto the next content line. Document any new profile behaviors in README + UI hints.
- Demo content should exercise the default-first script language (`#A/#B/#C`, `#default`, pauses/holds, and bold emphasis) so cinematic profiles stay verifiable in preview builds; keep `public/demo-lines.txt` aligned with the latest profile intent.
- `[BREAK]` / `[BR=n]` tokens insert paragraph spacing before the next line; keep `paragraphGap` in sync with doc/UI defaults when adjusting layout rules.
- Theme toggles must flip both background and text palettes (light default = white bg/black text, dark = black bg/white text) and persist through seeds/localStorage; keep defaults/seeds set to the light palette unless a test profile explicitly overrides it.
- Typography presets now map to `docs/TYPOGRAPHY.md` (Epic/Modern/Luxury/Sci-Fi); keep the preset labels, font URLs, and spacing/depth defaults in sync across `public/index.html`, seeds, and README when making adjustments.
- Line alignment (left/center/right) is configurable in the UI and advanced cfg; keep the dropdown labels, default (`center`), seeds, and README hints synchronized when tuning layout behavior.
- Keep the UI responsive for portrait/landscape testing; updates to `public/index.html` should preserve the mobile-friendly width variable and collapsed transforms that avoid page scrolling.
- Camera framing should keep the active/neighboring words visible: the dynamic FOV/distance framing logic in `public/index.html` must be preserved or improved so highlighted words never drift outside the viewport when spawned.
- Terminal framing must finish with a right-of-center overhang: preserve the end-overhang blend so the camera clamps toward `maxX + endOverhangPx + endOverhangFactor × lastWidth` instead of re-centering on the final word.
- Active word highlighting should remain smooth and readable: keep the per-frame glow/scale smoothing (with softer neighbor glow) so semantic emphasis remains apparent even after the reveal completes.
- When keep-previous-lines stacking is enabled, use measured line heights to avoid overlap; if stacking is off, completed lines should clear to keep the frame legible. Update README/UI hints when altering this flow.
- Emphasis visibility relies on semantic bold plus the glow/scale defaults; adjust materials/emphasis values and documentation together so bold words remain visually distinct.
- Reveal styles are enumerated (slide-up, grow-up, bloom, fade-scale, word-fade, char-fade, typewriter); keep the dropdown, defaults, and seed values in sync, and normalize legacy `rise` to `slide-up` for backward compatibility.
- Punctuation pacing defaults (comma/sentence/dash pauses) should stay synced across `public/index.html`, README, and localStorage seeds when tuning fallback/cue timing.
- The shared lighting rig lives in `public/lighting-rig.js` and is tested; adjust light/material specs there and keep the rig tests in sync when retuning shading or palette-dependent behavior.
- The lighting rig now anchors key/fill lights to the scene and lifts near-black text colors for readability; keep palette updates and the rig tests aligned when tuning emissive/roughness values.
- Text geometry uses `buildTextGeometrySpec` (in `public/animation-helpers.js`) to increase curve segments and add a subtle bevel for deeper extrusions; keep geometry defaults and helper tests aligned when retuning textDepth behavior.
- The Python bridge now runs on FastAPI/uvicorn and serves `public/index.html`; keep the docker-compose include chain (`docker-compose.yaml` → `docker/docker-compose.yaml`) intact when adjusting dev workflows.
- SRT exports land in `captions/` and should enqueue an import attempt; keep that directory as the default output for new endpoints or jobs.
- The LAN captioner now lives in `app/main.py`; keep its file-serving allowlist and `CAPTIONER_PROJECTS_ROOT` contract in sync with docker compose bindings when extending the API.
