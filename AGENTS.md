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
- Keep the UI responsive for portrait/landscape testing; updates to `public/index.html` should preserve the mobile-friendly width variable and collapsed transforms that avoid page scrolling.
- Camera framing should keep the active/neighboring words visible: the dynamic FOV/distance framing logic in `public/index.html` must be preserved or improved so highlighted words never drift outside the viewport when spawned.
- Terminal framing must finish with a right-of-center overhang: preserve the end-overhang blend so the camera clamps toward `maxX + endOverhangPx + endOverhangFactor × lastWidth` instead of re-centering on the final word.
- Active word highlighting should remain smooth and readable: keep the per-frame glow/scale smoothing (with softer neighbor glow) so semantic emphasis remains apparent even after the reveal completes.
- When keep-previous-lines stacking is enabled, use measured line heights to avoid overlap; if stacking is off, completed lines should clear to keep the frame legible. Update README/UI hints when altering this flow.
- Emphasis visibility relies on semantic bold plus the glow/scale defaults; adjust materials/emphasis values and documentation together so bold words remain visually distinct.
- Reveal styles are enumerated (slide-up, grow-up, bloom, word-fade, char-fade, typewriter); keep the dropdown, defaults, and seed values in sync, and normalize legacy `rise` to `slide-up` for backward compatibility.
