# Repository-wide AGENT Guidance

This file applies to the entire repository.

- Treat **bold** markers in transcripts or fallback text as semantic emphasis; strip the asterisks from rendered text but preserve the emphasis flag for animation logic.
- Emphasis behavior must follow the stacked rule system: normal words use the baseline animation, emphasized words apply the semantic emphasis profile, terminal (last) words apply the terminal emphasis tweaks, and bold + last words stack both.
- Default emphasis profile to keep aligned with docs/UI: `documentary` with scale 1.08, settle 260ms, semantic drift 0.08×word width, terminal drift 0.45×word width, semantic hold +120ms, terminal hold +300ms, follow multipliers 0.72 (emphasis) / 0.80 (terminal), look-at multipliers 0.75 (emphasis) / 0.85 (terminal).
- Whenever cfg defaults or emphasis/reveal presets change, update README and in-app hints in `public/index.html` to stay in sync.
- Keep changes minimal and idempotent; prefer extending existing files over introducing new ones.
- Profile-token parsing must remain default-first: start in the default profile unless a `#A/#B/#C` switch is encountered. Directive-only lines switch the active profile without rendering text, and `[PAUSE=ms]` / `[HOLD=ms]` tokens should accumulate onto the next content line. Document any new profile behaviors in README + UI hints.
