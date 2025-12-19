# DaVinci Resolve 3D Caption Glider

A beautiful 3D animated caption system for DaVinci Resolve that automatically syncs with your audio transcription. Words glide smoothly across the screen with pop-in animations, perfectly timed to your voiceover.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.8+-green.svg)
![DaVinci Resolve](https://img.shields.io/badge/DaVinci%20Resolve-18%2B-red.svg)

## ✨ Features

- 🎬 **Auto-sync with DaVinci Resolve** - Reads transcription directly from your timeline
- 🎯 **Word-level timing** - Each word appears exactly when spoken
- 🎨 **3D animated text** - Smooth camera glide with pop-in reveal animations
- 🛰️ **Auto-framed camera** - Active words and neighbors stay in view across portrait/landscape
- ⚡ **Real-time preview** - See your captions before adding to timeline
- 🔄 **One-click export** - Send captions back to Resolve as subtitle track
- 🎭 **Customizable styling** - Adjust colors, timing, animation curves, and more

## 🎥 Demo

[Add demo GIF/video here]

## 📋 Prerequisites

- **DaVinci Resolve 18+** (Studio or Free)
- **Python 3.8+**
- Modern web browser (Chrome, Firefox, Safari, Edge)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/Cdaprod/DaVinci-Resolve-3D-Caption-Glider.git
cd DaVinci-Resolve-3D-Caption-Glider
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Set Up DaVinci Resolve Python Path

**macOS:**

```bash
export PYTHONPATH="/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/:$PYTHONPATH"
```

**Windows:**

```cmd
set PYTHONPATH=C:\Program Files\Blackmagic Design\DaVinci Resolve\fusionscript;%PYTHONPATH%
```

**Linux:**

```bash
export PYTHONPATH="/opt/resolve/libs/Fusion/:$PYTHONPATH"
```

### 4. Transcribe Your Audio in Resolve

1. Open your project in DaVinci Resolve
1. Select the audio/video clip on your timeline
1. Right-click → **Transcribe Audio**
1. Choose your language → Click **OK**
1. Wait for transcription to complete

### 5. Run the Server

```bash
python main.py
```

### 6. Open in Browser

Navigate to `http://localhost:8080` in your web browser.

### 7. Testing helpers

Run the lightweight helper checks to confirm math helpers and clamping logic behave as expected:

```bash
node tests/animation-helpers.test.js
```

## 🎮 Usage

### Basic Workflow

1. **Load Transcription**

- Click “Load from Resolve” button
- Captions auto-sync with your voiceover timing
- Preview the 3D animation in real-time

1. **Customize (Optional)**

- Edit `cfg` object in HTML for styling
- Adjust animation speed, colors, reveal timing
- Swap fonts using the new preset dropdown (Akira Expanded, Impact, Inter Black via CDN, Apple Garamond, or your own URL) and pick reveal styles (pop rise vs. grow-up) plus emphasis profiles (Documentary or Minimal)

1. **Export to Timeline**

- Click “Create Captions” to add subtitles to Resolve
- Captions appear as a new subtitle track
- Perfectly synced with word-level timing

### Alternative: Manual Text Input

If you don’t have audio transcription, create a `public/lines.txt` file:

```txt
This is my first caption line
Here's the second one
And a third line appears
```

The system will fall back to this file automatically.

## ⚙️ Configuration

Edit the `cfg` object in `public/index.html` (or use the built-in configuration drawer) to customize. Defaults are tuned for the cinematic long-line glide:

```javascript
const cfg = {
  // Sources
  linesUrl: './demo-lines.txt',

  // Fonts
  fontId: 'helvetiker',
  fontUrl: 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/fonts/helvetiker_regular.typeface.json',
  fontFormat: 'typeface', // typeface or ttf

  // Text appearance
  textSize: 0.10,
  textDepth: 0.001,
  color: 0xffffff,
  cameraDistance: 3.5,

  // Animation timing
  wordsPerSecond: 2.5,
  curveLookAheadU: 0.045,
  followLambda: 13.5,
  lookAtLambda: 9.5,
  revealWordLead: 1.15,

  // Reveal animation
  revealMs: 240,
  revealStartScale: 1.04,
  revealPopScale: 1.07,
  revealRise: 0.045,
  revealZ: 0.05,
  revealOvershoot: 0.02,
  revealStyle: 'slide-up', // slide-up (default), grow-up, bloom, fade-scale, word-fade, char-fade, typewriter

  emphasisProfile: 'documentary', // documentary (stacked emphasis) or minimal

  // Spacing & stacking
  spaceMultiplier: 1.82,
  keepPreviousLinesVisible: false,
  lineHoldMsAfterComplete: 620,
  stackLines: true,
  stackLineGap: 0.22,
  stackAnchor: 'bottom', // natural downward stacking
  stackMaxLines: 6,

  // Camera end bias
  endOverhangFactor: 0.65,
  endOverhangPx: 0.16,
  trackLeadPx: 0.06,
  endOverhangBlendU: 0.10,
  endEaseOutU: 0.14,
};
```

All UI-configurable values now persist to `localStorage` under the `captioner_state_v1` key. If you want to ship tuned defaults
with the demo, update `public/localStorage.json` (and optionally keep `public/alternate-test-versions/localStorage.json` in sync);
the app seeds `localStorage` from those files when no prior state exists.

You can switch fonts via presets (Akira Expanded, Impact, Inter Black via CDN, Apple Garamond Regular/Italic, or a custom URL) and choose a reveal style in the UI: **slide-up** (default), **grow-up**, **bloom**, **fade-scale**, **word fade**, **character fade**, or **typewriter** (left-anchored sweep).

Use the **BackgrounUse the **Background theme** dropdown to flip between light (default: white background, black text) and dark (black background, white text). The current theme, colors, and other UI settings persist to `localStorage` alongside your other cfg tweaks.
>>>>>>>+Updated upstrea
n to fliUse the **Background theme** dropdown to flip between dark (black background, white text) and light (white background, near-black text). The current theme, colors, and other UI settings persist to `localStorage` alongside your other cfg tweaks.
>>>>>>>-Stashed changes
fallback lines to flag semantic emphasis. The default “Documentary” emphasis profile stacks semantic emphasis (scale 1.08 with a 260ms settle and +120ms hold) with terminal-word cadence (+0.45× word-width drift and +300ms hold) so bold last words land with a gentle overhang. Active words now receive a per-frame glow/scale lift (with softened neighbor glow) so emphasis stays visible as the camera glides through each line. A “Minimal” profile is also available for a lighter touch.

When you enable `keepPreviousLinesVisible`, keep `stackLines` on to preserve legibility; stacked captions reflow using their measured heights and the configured gap so lines don’t overlap. If you disable stacking, completed lines clear automatically to keep the frame clean. Bold words render with a brighter glow on top of the emphasis scaling so semantic emphasis is visible even with the white text palette.

Camera distance acts as a baseline: the renderer automatically expands the distance (respecting your FOV/aspect) when wide lines or highlighted words would otherwise fall outside the viewport, keeping the active word plus its neighbors framed in both portrait and landscape orientations. The end-overhang blend ensures the camera finishes to the right of the last word—during the final U-blend window it clamps toward `maxX + endOverhangPx + endOverhangFactor × lastWidth` so terminal words never re-center.

### Profile scripting with `#A/#B/#C` (default-first)

You start in the default profile automatically—no leading token required. Add a directive-only line to switch moods, or prefix a line to switch and render on the same row:

```text
Cinematic scripting starts in default (no marker required)
#A Calm dolly profile slows the follow and softens reveals
[PAUSE=220]
#B Assertive pacing tightens follow and pops punctuation
[HOLD=320]
#C Dramatic settle widens the lens and lingers on the last word
#default Return to the default glide once the moods finish
```

- `#A`, `#B`, `#C` toggle per-line camera/reveal pacing until the next switch; `#default` returns to the base glide.
- `[PAUSE=ms]` delays the next content line; `[HOLD=ms]` extends its post-line hold. Directive-only lines with these tokens carry the pause/hold forward.
- `[BREAK]` (or `[BR=n]`) inserts a blank paragraph gap before the next caption using the `paragraphGap` spacing.
- Profiles adjust follow tightness, look-ahead, camera distance, overhang bias, reveal style, and pacing speed while stacking with the existing semantic/terminal emphasis rules.
- Profile moods: **A** = calm dolly with wider distance and softer bias, **B** = tight/assertive with faster follow and a sharper pop, **C** = dramatic settle with long holds, farther camera, and lingering overhang.

## 📁 Project Structure

```
resolve-3d-caption-glider/
├── main.py                 # Flask server + Resolve API bridge
├── requirements.txt        # Python dependencies
├── README.md              # This file
├── LICENSE                # MIT License
└── public/
    ├── index.html         # 3D caption renderer (Three.js)
    └── lines.txt          # Optional: Manual caption lines
```

## 🔌 API Endpoints

|Endpoint                       |Method|Description                           |
|-------------------------------|------|--------------------------------------|
|`/api/get-transcription`       |GET   |Fetch transcription from selected clip|
|`/api/create-animated-captions`|POST  |Create synced captions on timeline    |
|`/api/timeline-info`           |GET   |Get current timeline metadata         |
|`/api/export-srt`              |POST  |Export captions as SRT file           |

## 🎨 Customization Examples

### Change Text Color to Yellow

```javascript
color: 0xffff00,
```

### Faster Animation

```javascript
wordsPerSecond: 5.0,
followLambda: 50,
```

### Subtle Pop Effect

```javascript
revealPopScale: 1.10,
revealOvershoot: 0.15,
```

### Bigger Text

```javascript
textSize: 0.25,
textDepth: 0.05,
```

## 🐛 Troubleshooting

### “Could not connect to DaVinci Resolve”

- Ensure DaVinci Resolve is **running**
- Check that a **project is open**
- Verify a **timeline is active**
- Restart both Resolve and the server

### “No transcription found”

- Select a clip with audio on the timeline
- Right-click → **Transcribe Audio** first
- Wait for transcription to complete (check progress in Resolve)

### Python Module Not Found

```bash
# Verify PYTHONPATH is set correctly
echo $PYTHONPATH  # macOS/Linux
echo %PYTHONPATH% # Windows

# Should include Resolve's Fusion directory
```

### Port 8080 Already in Use

Edit `main.py` and change the port:

```python
app.run(host='0.0.0.0', port=3000, debug=True)  # Use different port
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
1. Create your feature branch (`git checkout -b feature/AmazingFeature`)
1. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
1. Push to the branch (`git push origin feature/AmazingFeature`)
1. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the <LICENSE> file for details.

## 🙏 Acknowledgments

- Built with [Three.js](https://threejs.org/) for 3D rendering
- [Flask](https://flask.palletsprojects.com/) for Python web framework
- DaVinci Resolve API by Blackmagic Design

## 📧 Support

- 🐛 [Report bugs](https://github.com/Cdaprod/DaVinci-Resolve-3D-Caption-Glider/issues)
- 💡 [Request features](https://github.com/Cdaprod/DaVinci-Resolve-3D-Caption-Glider/issues)
- ⭐ Star this repo if you find it useful!

## 🔮 Roadmap

- [ ] Per-word color highlighting
- [ ] Export to Fusion compositions
- [ ] Multiple font support
- [ ] Preset animation styles
- [ ] Batch processing multiple clips
- [ ] Real-time preview sync with Resolve playback
- [ ] Custom easing curves editor

-----

Made with ❤️ for video editors
# DaVinci Resolve 3D Caption Glider

A beautiful 3D animated caption system for DaVinci Resolve that automatically syncs with your audio transcription. Words glide smoothly across the screen with pop-in animations, perfectly timed to your voiceover.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.8+-green.svg)
![DaVinci Resolve](https://img.shields.io/badge/DaVinci%20Resolve-18%2B-red.svg)

## ✨ Features

- 🎬 **Auto-sync with DaVinci Resolve** - Reads transcription directly from your timeline
- 🎯 **Word-level timing** - Each word appears exactly when spoken
- 🎨 **3D animated text** - Smooth camera glide with pop-in reveal animations
- 🛰️ **Auto-framed camera** - Active words and neighbors stay in view across portrait/landscape
- ⚡ **Real-time preview** - See your captions before adding to timeline
- 🔄 **One-click export** - Send captions back to Resolve as subtitle track
- 🎭 **Customizable styling** - Adjust colors, timing, animation curves, and more

## 🎥 Demo

[Add demo GIF/video here]

## 📋 Prerequisites

- **DaVinci Resolve 18+** (Studio or Free)
- **Python 3.8+**
- Modern web browser (Chrome, Firefox, Safari, Edge)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/Cdaprod/DaVinci-Resolve-3D-Caption-Glider.git
cd DaVinci-Resolve-3D-Caption-Glider
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Set Up DaVinci Resolve Python Path

**macOS:**

```bash
export PYTHONPATH="/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/:$PYTHONPATH"
```

**Windows:**

```cmd
set PYTHONPATH=C:\Program Files\Blackmagic Design\DaVinci Resolve\fusionscript;%PYTHONPATH%
```

**Linux:**

```bash
export PYTHONPATH="/opt/resolve/libs/Fusion/:$PYTHONPATH"
```

### 4. Transcribe Your Audio in Resolve

1. Open your project in DaVinci Resolve
1. Select the audio/video clip on your timeline
1. Right-click → **Transcribe Audio**
1. Choose your language → Click **OK**
1. Wait for transcription to complete

### 5. Run the Server

```bash
python main.py
```

### 6. Open in Browser

Navigate to `http://localhost:8080` in your web browser.

### 7. Testing helpers

Run the lightweight helper checks to confirm math helpers and clamping logic behave as expected:

```bash
node tests/animation-helpers.test.js
```

## 🎮 Usage

### Basic Workflow

1. **Load Transcription**

- Click “Load from Resolve” button
- Captions auto-sync with your voiceover timing
- Preview the 3D animation in real-time

1. **Customize (Optional)**

- Edit `cfg` object in HTML for styling
- Adjust animation speed, colors, reveal timing
- Swap fonts using the new preset dropdown (Akira Expanded, Impact, Inter Black via CDN, Apple Garamond, or your own URL) and pick reveal styles (pop rise vs. grow-up) plus emphasis profiles (Documentary or Minimal)

1. **Export to Timeline**

- Click “Create Captions” to add subtitles to Resolve
- Captions appear as a new subtitle track
- Perfectly synced with word-level timing

### Alternative: Manual Text Input

If you don’t have audio transcription, create a `public/lines.txt` file:

```txt
This is my first caption line
Here's the second one
And a third line appears
```

The system will fall back to this file automatically.

## ⚙️ Configuration

Edit the `cfg` object in `public/index.html` (or use the built-in configuration drawer) to customize. Defaults are tuned for the cinematic long-line glide:

```javascript
const cfg = {
  // Sources
  linesUrl: './demo-lines.txt',

  // Fonts
  fontId: 'helvetiker',
  fontUrl: 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/fonts/helvetiker_regular.typeface.json',
  fontFormat: 'typeface', // typeface or ttf

  // Text appearance
  textSize: 0.10,
  textDepth: 0.001,
  color: 0xffffff,
  cameraDistance: 3.5,

  // Animation timing
  wordsPerSecond: 2.5,
  curveLookAheadU: 0.045,
  followLambda: 13.5,
  lookAtLambda: 9.5,
  revealWordLead: 1.15,

  // Reveal animation
  revealMs: 240,
  revealStartScale: 1.04,
  revealPopScale: 1.07,
  revealRise: 0.045,
  revealZ: 0.05,
  revealOvershoot: 0.02,
  revealStyle: 'slide-up', // slide-up (default), grow-up, bloom, fade-scale, word-fade, char-fade, typewriter

  emphasisProfile: 'documentary', // documentary (stacked emphasis) or minimal

  // Spacing & stacking
  spaceMultiplier: 1.82,
  keepPreviousLinesVisible: false,
  lineHoldMsAfterComplete: 620,
  stackLines: true,
  stackLineGap: 0.22,
  stackAnchor: 'bottom', // natural downward stacking
  stackMaxLines: 6,

  // Camera end bias
  endOverhangFactor: 0.65,
  endOverhangPx: 0.16,
  trackLeadPx: 0.06,
  endOverhangBlendU: 0.10,
  endEaseOutU: 0.14,
};
```

All UI-configurable values now persist to `localStorage` under the `captioner_state_v1` key. If you want to ship tuned defaults
with the demo, update `public/localStorage.json` (and optionally keep `public/alternate-test-versions/localStorage.json` in sync);
the app seeds `localStorage` from those files when no prior state exists.

You can switch fonts via presets (Akira Expanded, Impact, Inter Black via CDN, Apple Garamond Regular/Italic, or a custom URL) and choose a reveal style in the UI: **slide-up** (default), **grow-up**, **bloom**, **fade-scale**, **word fade**, **character fade**, or **typewriter** (left-anchored sweep).

<<<<<<< Updated upstream
Use the **BackgrounUse the **Background theme** dropdown to flip between light (default: white background, black text) and dark (black background, white text). The current theme, colors, and other UI settings persist to `localStorage` alongside your other cfg tweaks.
>>>>>>>+Updated upstrea
n to fliUse the **Background theme** dropdown to flip between dark (black background, white text) and light (white background, near-black text). The current theme, colors, and other UI settings persist to `localStorage` alongside your other cfg tweaks.
>>>>>>>-Stashed changes
fallback lines to flag semantic emphasis. The default “Documentary” emphasis profile stacks semantic emphasis (scale 1.08 with a 260ms settle and +120ms hold) with terminal-word cadence (+0.45× word-width drift and +300ms hold) so bold last words land with a gentle overhang. Active words now receive a per-frame glow/scale lift (with softened neighbor glow) so emphasis stays visible as the camera glides through each line. A “Minimal” profile is also available for a lighter touch.

When you enable `keepPreviousLinesVisible`, keep `stackLines` on to preserve legibility; stacked captions reflow using their measured heights and the configured gap so lines don’t overlap. If you disable stacking, completed lines clear automatically to keep the frame clean. Bold words render with a brighter glow on top of the emphasis scaling so semantic emphasis is visible even with the white text palette.

Camera distance acts as a baseline: the renderer automatically expands the distance (respecting your FOV/aspect) when wide lines or highlighted words would otherwise fall outside the viewport, keeping the active word plus its neighbors framed in both portrait and landscape orientations. The end-overhang blend ensures the camera finishes to the right of the last word—during the final U-blend window it clamps toward `maxX + endOverhangPx + endOverhangFactor × lastWidth` so terminal words never re-center.

### Profile scripting with `#A/#B/#C` (default-first)

You start in the default profile automatically—no leading token required. Add a directive-only line to switch moods, or prefix a line to switch and render on the same row:

```text
Cinematic scripting starts in default (no marker required)
#A Calm dolly profile slows the follow and softens reveals
[PAUSE=220]
#B Assertive pacing tightens follow and pops punctuation
[HOLD=320]
#C Dramatic settle widens the lens and lingers on the last word
#default Return to the default glide once the moods finish
```

- `#A`, `#B`, `#C` toggle per-line camera/reveal pacing until the next switch; `#default` returns to the base glide.
- `[PAUSE=ms]` delays the next content line; `[HOLD=ms]` extends its post-line hold. Directive-only lines with these tokens carry the pause/hold forward.
- `[BREAK]` (or `[BR=n]`) inserts a blank paragraph gap before the next caption using the `paragraphGap` spacing.
- Profiles adjust follow tightness, look-ahead, camera distance, overhang bias, reveal style, and pacing speed while stacking with the existing semantic/terminal emphasis rules.
- Profile moods: **A** = calm dolly with wider distance and softer bias, **B** = tight/assertive with faster follow and a sharper pop, **C** = dramatic settle with long holds, farther camera, and lingering overhang.

## 📁 Project Structure

```
resolve-3d-caption-glider/
├── main.py                 # Flask server + Resolve API bridge
├── requirements.txt        # Python dependencies
├── README.md              # This file
├── LICENSE                # MIT License
└── public/
    ├── index.html         # 3D caption renderer (Three.js)
    └── lines.txt          # Optional: Manual caption lines
```

## 🔌 API Endpoints

|Endpoint                       |Method|Description                           |
|-------------------------------|------|--------------------------------------|
|`/api/get-transcription`       |GET   |Fetch transcription from selected clip|
|`/api/create-animated-captions`|POST  |Create synced captions on timeline    |
|`/api/timeline-info`           |GET   |Get current timeline metadata         |
|`/api/export-srt`              |POST  |Export captions as SRT file           |

## 🎨 Customization Examples

### Change Text Color to Yellow

```javascript
color: 0xffff00,
```

### Faster Animation

```javascript
wordsPerSecond: 5.0,
followLambda: 50,
```

### Subtle Pop Effect

```javascript
revealPopScale: 1.10,
revealOvershoot: 0.15,
```

### Bigger Text

```javascript
textSize: 0.25,
textDepth: 0.05,
```

## 🐛 Troubleshooting

### “Could not connect to DaVinci Resolve”

- Ensure DaVinci Resolve is **running**
- Check that a **project is open**
- Verify a **timeline is active**
- Restart both Resolve and the server

### “No transcription found”

- Select a clip with audio on the timeline
- Right-click → **Transcribe Audio** first
- Wait for transcription to complete (check progress in Resolve)

### Python Module Not Found

```bash
# Verify PYTHONPATH is set correctly
echo $PYTHONPATH  # macOS/Linux
echo %PYTHONPATH% # Windows

# Should include Resolve's Fusion directory
```

### Port 8080 Already in Use

Edit `main.py` and change the port:

```python
app.run(host='0.0.0.0', port=3000, debug=True)  # Use different port
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
1. Create your feature branch (`git checkout -b feature/AmazingFeature`)
1. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
1. Push to the branch (`git push origin feature/AmazingFeature`)
1. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the <LICENSE> file for details.

## 🙏 Acknowledgments

- Built with [Three.js](https://threejs.org/) for 3D rendering
- [Flask](https://flask.palletsprojects.com/) for Python web framework
- DaVinci Resolve API by Blackmagic Design

## 📧 Support

- 🐛 [Report bugs](https://github.com/Cdaprod/DaVinci-Resolve-3D-Caption-Glider/issues)
- 💡 [Request features](https://github.com/Cdaprod/DaVinci-Resolve-3D-Caption-Glider/issues)
- ⭐ Star this repo if you find it useful!

## 🔮 Roadmap

- [ ] Per-word color highlighting
- [ ] Export to Fusion compositions
- [ ] Multiple font support
- [ ] Preset animation styles
- [ ] Batch processing multiple clips
- [ ] Real-time preview sync with Resolve playback
- [ ] Custom easing curves editor

-----

Made with ❤️ for video editors
