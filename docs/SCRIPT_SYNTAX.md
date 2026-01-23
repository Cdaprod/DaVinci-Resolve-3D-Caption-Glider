# Caption Script Inline Syntax

Use these inline tokens in `public/demo-lines.txt` or any lines-driven script input to control pacing, profiles, and emphasis. The parser is **default-first**: it starts in the default profile unless you switch with `#A/#B/#C` (or `#default`). Directive-only lines change the active profile without rendering text.

## Profile switches

Profile markers change the active line profile for subsequent lines.

- `#A` / `#B` / `#C` — switch to profile A/B/C.
- `#default` — return to the default profile.

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
