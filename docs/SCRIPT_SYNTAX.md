# Caption Script Inline Syntax

Use these inline tokens in `public/demo-lines.txt` or any lines-driven script input to control pacing, profiles, and emphasis. The parser is **default-first**: it starts in the default profile unless you switch with `#A/#B/#C` (or `#default`). Directive-only lines change the active profile without rendering text.

## Profile switches

Profile markers change the active line profile for subsequent lines.

- `#A` / `#B` / `#C` — switch to profile A/B/C.
- `#default` — return to the default profile.

### Cinematic + virtual camera meaning (current presets)

Profiles map to **line presets** in `public/index.html`. They change how the virtual camera follows the text line, how quickly the line plays, and how the reveal animates. In editing terms: they are *shot direction notes* that bias the dolly, lens, and hold beats for the next line(s).

**Core controls (what the numbers mean):**

- **speedMultiplier** — pacing of word timing (higher = faster line delivery, lower = slower). This scales the fallback word timing and, in effect, the editorial tempo of the line.
- **followMult** — how aggressively the camera position follows the active word (higher = tighter chase, lower = more drifting glide).
- **lookAtMult** — how aggressively the camera look-at target follows the active word (higher = snappier aim, lower = softer aim).
- **lookAheadOffset** — small predictive offset toward upcoming words (positive = lead the line, negative = lag a touch).
- **cameraDistanceOffset** — pushes the camera closer or farther (negative = tighter framing, positive = wider framing).
- **holdMs** — extra hold added after the line completes (editorial linger).
- **revealStyle** — per-line reveal style override (e.g., `slide-up`, `grow-up`).
- **endBiasPx** — extra rightward bias at the end of the line (finishes a touch past center for an overhang).

**Default profile (`#default`): baseline glide**

- **Editing intent:** neutral delivery, standard dolly + look-at follow, no extra editorial hold.
- **Values:** `speedMultiplier=1`, `followMult=1`, `lookAtMult=1`, `lookAheadOffset=0`, `cameraDistanceOffset=0`, `holdMs=0`, `revealStyle=null`, `endBiasPx=0`.

**Profile A (`#A`): calm dolly**

- **Editing intent:** steadier, slower glide; let the words breathe with a gentle camera lead.
- **Values:** `speedMultiplier=0.9`, `followMult=0.86`, `lookAtMult=0.9`, `lookAheadOffset=-0.006`, `cameraDistanceOffset=0.1`, `holdMs=160`, `revealStyle=grow-up`, `endBiasPx=0.025`.
- **Cinematic translation:** slightly slower line delivery, softer follow/aim, subtly wider framing, and a short tail hold to settle the shot.

**Profile B (`#B`): tight + assertive**

- **Editing intent:** punchier cadence, tighter camera follow, and more aggressive punctuation landings.
- **Values:** `speedMultiplier=1.12`, `followMult=1.18`, `lookAtMult=1.1`, `lookAheadOffset=0.014`, `cameraDistanceOffset=-0.07`, `holdMs=90`, `revealStyle=slide-up`, `endBiasPx=0.05`.
- **Cinematic translation:** faster line delivery, tighter framing, forward-looking aim, short editorial hold—use for emphasis or momentum.

**Profile C (`#C`): dramatic settle**

- **Editing intent:** slower, heavier settle with a wider lens and a longer hold on the last word.
- **Values:** `speedMultiplier=0.82`, `followMult=0.8`, `lookAtMult=0.88`, `lookAheadOffset=-0.015`, `cameraDistanceOffset=0.16`, `holdMs=260`, `revealStyle=grow-up`, `endBiasPx=0.07`.
- **Cinematic translation:** slower cadence, softer follow, wider framing, and a longer tail hold—use for gravitas or dramatic beats.

Use a profile token at the start of a line with optional text:

```txt
#A Calm dolly line
#B Assertive punch lands here
#default Back to baseline glide
```

Directive-only lines are allowed and do **not** render text:

```txt
#B
This line uses profile B.
```

## Timing tokens

Timing tokens accumulate onto the **next** content line. Multiple tokens on separate lines stack together.

- `[PAUSE=ms]` — delay before the next line begins.
- `[HOLD=ms]` — extend the hold after the line completes.

Example:

```txt
[PAUSE=200]
#A The camera settles before this line starts.
[HOLD=320]
#default This line lingers a bit longer.
```

## Paragraph spacing tokens

Paragraph tokens insert extra paragraph spacing **before** the next line.

- `[BREAK]` — insert one paragraph gap.
- `[BR=n]` — insert `n` paragraph gaps.

Example:

```txt
First paragraph line.
[BREAK]
Second paragraph line.
[BR=2]
Third paragraph line with extra spacing.
```

## Emphasis (bold) tokens

Wrap a word or phrase in double asterisks to mark it as semantically emphasized. The asterisks are stripped from the rendered text but the emphasis flag is preserved for animation.

```txt
This is **important** for emphasis.
```

## Punctuation pacing (automatic)

Comma, sentence-ending punctuation, and dashes trigger pacing adjustments when the default timing system is used. This is automatic, so you don’t need special tokens.

```txt
This line breathes at commas, and settles at the period.
```

## Full example

```txt
#default So what you’re looking at right now,
is actually the overhead camera.
[PAUSE=180]

#A And yeah, I know — it’s kind of funny that you’re watching a camera...
...from another camera.
[PAUSE=220]

#default But for what I’m doing, this thing is honestly... **perfect**
[HOLD=280]
[BREAK]
#B "What the hell is this guy doing?"
```

## Tips

- Use `#default` to ensure you return to baseline behavior after a profile block.
- Use `[PAUSE=ms]` before a line to let the camera settle.
- Use `[HOLD=ms]` after important lines to give the audience time to absorb key points.
- Prefer `**bold**` for semantic emphasis rather than manual capitalization.
