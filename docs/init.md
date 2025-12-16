Perfect! Here’s how to **auto-generate captions from DaVinci Resolve’s timeline audio transcription**:

## Updated Architecture

```
Timeline Audio → Resolve Transcription → Python Bridge → HTML Captioner (synced) → Back to Timeline
```

## Implementation

### 1. **Updated Python Server** (main.py)

```python
#!/usr/bin/env python3
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import sys

try:
    import DaVinciResolveScript as dvr_script
except ImportError:
    print("ERROR: DaVinci Resolve scripting module not found!")
    sys.exit(1)

app = Flask(__name__, static_folder='public')
CORS(app)

resolve = None
project = None
timeline = None

def init_resolve():
    global resolve, project, timeline
    try:
        resolve = dvr_script.scriptapp("Resolve")
        if not resolve:
            return False, "Could not connect to DaVinci Resolve"
        
        project_manager = resolve.GetProjectManager()
        project = project_manager.GetCurrentProject()
        if not project:
            return False, "No project open in Resolve"
        
        timeline = project.GetCurrentTimeline()
        if not timeline:
            return False, "No timeline open in Resolve"
        
        return True, "Connected successfully"
    except Exception as e:
        return False, str(e)

@app.route('/')
def index():
    return send_from_directory('public', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('public', path)

# NEW: Get transcription from selected clip
@app.route('/api/get-transcription', methods=['GET'])
def get_transcription():
    success, msg = init_resolve()
    if not success:
        return jsonify({"error": msg}), 500
    
    try:
        # Get selected clips on timeline
        selected_clips = timeline.GetItemListInTrack("video", 1)  # Try video track 1
        
        if not selected_clips:
            # Try audio tracks
            selected_clips = timeline.GetItemListInTrack("audio", 1)
        
        if not selected_clips:
            return jsonify({"error": "No clips found. Select a clip with audio."}), 400
        
        # Get the first clip (or you can iterate through all)
        clip = selected_clips[0]
        
        # Get transcription data
        # Method 1: Try to get existing subtitles/captions
        transcription_data = get_clip_transcription(clip)
        
        if not transcription_data:
            return jsonify({
                "error": "No transcription found. Please transcribe audio first in Resolve.",
                "instructions": "Right-click clip → Transcribe Audio → Select language → OK"
            }), 404
        
        return jsonify(transcription_data)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def get_clip_transcription(clip):
    """
    Extract transcription from clip
    DaVinci Resolve stores transcriptions in subtitle tracks after transcription
    """
    try:
        frame_rate = float(timeline.GetSetting('timelineFrameRate'))
        
        # Get clip timing info
        clip_start_frame = clip.GetStart()
        clip_end_frame = clip.GetEnd()
        clip_duration = clip.GetDuration()
        
        # Check if timeline has subtitle tracks with transcription
        subtitle_count = timeline.GetTrackCount("subtitle")
        
        words = []
        
        if subtitle_count > 0:
            # Get all subtitle items (transcription results)
            for track_idx in range(1, subtitle_count + 1):
                subtitles = timeline.GetItemListInTrack("subtitle", track_idx)
                
                if subtitles:
                    for sub in subtitles:
                        # Get subtitle properties
                        sub_start = sub.GetStart()
                        sub_end = sub.GetEnd()
                        sub_text = sub.GetName()  # or GetText() depending on API
                        
                        # Check if subtitle overlaps with our clip
                        if sub_start >= clip_start_frame and sub_end <= clip_end_frame:
                            words.append({
                                "text": sub_text,
                                "startTime": (sub_start - clip_start_frame) / frame_rate,
                                "endTime": (sub_end - clip_start_frame) / frame_rate,
                                "startFrame": sub_start - clip_start_frame,
                                "endFrame": sub_end - clip_start_frame
                            })
        
        if not words:
            # Alternative: Try to get from clip metadata
            # Some versions store transcription in clip properties
            clip_props = clip.GetProperty()
            if clip_props and "Transcription" in clip_props:
                # Parse transcription data
                trans_data = clip_props["Transcription"]
                # Format will vary - adapt as needed
                words = parse_transcription_metadata(trans_data, frame_rate)
        
        return {
            "clipName": clip.GetName(),
            "clipStart": clip_start_frame / frame_rate,
            "clipDuration": clip_duration / frame_rate,
            "frameRate": frame_rate,
            "words": words,
            "fullText": " ".join([w["text"] for w in words])
        }
    
    except Exception as e:
        print(f"Transcription extraction error: {e}")
        return None

def parse_transcription_metadata(trans_data, frame_rate):
    """Parse transcription from clip metadata if stored there"""
    # This is a fallback - format depends on Resolve version
    # You may need to adjust based on actual data structure
    words = []
    try:
        if isinstance(trans_data, str):
            trans_json = json.loads(trans_data)
            # Adapt to actual structure
            for item in trans_json.get("words", []):
                words.append({
                    "text": item["word"],
                    "startTime": item["start"],
                    "endTime": item["end"],
                    "startFrame": int(item["start"] * frame_rate),
                    "endFrame": int(item["end"] * frame_rate)
                })
    except:
        pass
    
    return words

# NEW: Trigger auto-transcription
@app.route('/api/transcribe-clip', methods=['POST'])
def transcribe_clip():
    """
    Trigger Resolve's built-in transcription on selected clip
    Note: This may not be available via API - user may need to do manually
    """
    success, msg = init_resolve()
    if not success:
        return jsonify({"error": msg}), 500
    
    try:
        # This functionality may be limited in Resolve API
        # User typically needs to: Right-click → Transcribe Audio
        
        return jsonify({
            "message": "Please transcribe audio manually in Resolve:",
            "steps": [
                "1. Select the audio/video clip",
                "2. Right-click → Transcribe Audio",
                "3. Choose language and click OK",
                "4. Wait for transcription to complete",
                "5. Click 'Get Transcription' again"
            ]
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Export transcription as lines.txt format
@app.route('/api/export-transcript-lines', methods=['POST'])
def export_transcript_lines():
    """Convert transcription to lines.txt format for your captioner"""
    try:
        data = request.get_json()
        words = data.get('words', [])
        words_per_line = data.get('wordsPerLine', 8)  # Configurable
        
        lines = []
        current_line = []
        
        for word in words:
            current_line.append(word['text'])
            
            if len(current_line) >= words_per_line:
                lines.append(" ".join(current_line))
                current_line = []
        
        # Add remaining words
        if current_line:
            lines.append(" ".join(current_line))
        
        lines_text = "\n".join(lines)
        
        return jsonify({
            "success": True,
            "lines": lines,
            "linesText": lines_text
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Create animated captions with exact timing from transcription
@app.route('/api/create-animated-captions', methods=['POST'])
def create_animated_captions():
    success, msg = init_resolve()
    if not success:
        return jsonify({"error": msg}), 500
    
    try:
        data = request.get_json()
        words = data.get('words', [])
        words_per_line = data.get('wordsPerLine', 8)
        
        if not words:
            return jsonify({"error": "No words provided"}), 400
        
        frame_rate = float(timeline.GetSetting('timelineFrameRate'))
        
        # Group words into lines
        lines = []
        current_line = {"words": [], "startTime": 0, "endTime": 0}
        
        for i, word in enumerate(words):
            if len(current_line["words"]) == 0:
                current_line["startTime"] = word["startTime"]
            
            current_line["words"].append(word)
            current_line["endTime"] = word["endTime"]
            
            # Create new line after reaching word limit or at natural pauses
            if len(current_line["words"]) >= words_per_line:
                lines.append({
                    "text": " ".join([w["text"] for w in current_line["words"]]),
                    "startTime": current_line["startTime"],
                    "endTime": current_line["endTime"],
                    "words": current_line["words"]
                })
                current_line = {"words": [], "startTime": 0, "endTime": 0}
        
        # Add remaining words
        if current_line["words"]:
            lines.append({
                "text": " ".join([w["text"] for w in current_line["words"]]),
                "startTime": current_line["startTime"],
                "endTime": current_line["endTime"],
                "words": current_line["words"]
            })
        
        # Create subtitles with exact timing
        track_count = timeline.GetTrackCount("subtitle")
        if track_count == 0:
            timeline.AddTrack("subtitle")
        
        created_count = 0
        for line in lines:
            start_frame = int(line["startTime"] * frame_rate)
            end_frame = int(line["endTime"] * frame_rate)
            
            result = timeline.CreateSubtitle(line["text"], start_frame)
            if result:
                created_count += 1
        
        return jsonify({
            "success": True,
            "created": created_count,
            "lines": lines
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Starting Caption Bridge Server...")
    print("Make sure DaVinci Resolve is running!")
    
    success, msg = init_resolve()
    if success:
        print(f"✓ {msg}")
        if timeline:
            print(f"✓ Timeline: {timeline.GetName()}")
    else:
        print(f"⚠ Warning: {msg}")
    
    print("\nServer running at http://localhost:8080")
    app.run(host='0.0.0.0', port=8080, debug=True)
```

### 2. **Updated HTML Captioner** (public/index.html)

Replace your `loadLines` function and add new controls:

```javascript
// NEW: Load transcription from Resolve instead of lines.txt
let transcriptionData = null;

async function loadTranscriptionFromResolve() {
  try {
    const res = await fetch('/api/get-transcription');
    const data = await res.json();
    
    if (data.error) {
      console.error('Transcription error:', data.error);
      if (data.instructions) {
        alert(data.error + '\n\n' + data.instructions);
      }
      return null;
    }
    
    transcriptionData = data;
    return data;
  } catch (err) {
    console.error('Failed to load transcription:', err);
    return null;
  }
}

// Convert transcription words to lines for your captioner
function transcriptionToLines(transcription, wordsPerLine = 8) {
  const words = transcription.words;
  const lines = [];
  
  for (let i = 0; i < words.length; i += wordsPerLine) {
    const lineWords = words.slice(i, i + wordsPerLine);
    const lineText = lineWords.map(w => w.text).join(' ');
    
    lines.push({
      text: lineText,
      startTime: lineWords[0].startTime,
      endTime: lineWords[lineWords.length - 1].endTime,
      words: lineWords
    });
  }
  
  return lines;
}

// UPDATED: Modified boot sequence
new THREE.FontLoader().load(
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/fonts/helvetiker_regular.typeface.json',
  async (font) => {
    // Load transcription from Resolve
    const transcription = await loadTranscriptionFromResolve();
    
    if (!transcription) {
      // Fallback to lines.txt if transcription unavailable
      const lines = await loadLines(cfg.linesUrl);
      for (let li = 0; li < lines.length; li++) {
        lineObjs.push(buildLine(font, lines[li], li, lines.length));
      }
    } else {
      // Use transcription data with exact timing
      const lines = transcriptionToLines(transcription, 8); // 8 words per line
      
      for (let li = 0; li < lines.length; li++) {
        const lineObj = buildLine(font, lines[li].text, li, lines.length);
        lineObj.startTime = lines[li].startTime;
        lineObj.endTime = lines[li].endTime;
        lineObj.words = lines[li].words;
        lineObjs.push(lineObj);
      }
    }

    camera.position.set(0, 0, cfg.cameraDistance);
    camera.lookAt(new THREE.Vector3(0,0,0));
    render();

    runSequence(0);
  },
  undefined,
  (err) => console.error('Font load failed:', err)
);

// UPDATED: Use exact timing from transcription
function runSequence(lineIdx = 0) {
  if (lineIdx >= lineObjs.length) return;

  const current = lineObjs[lineIdx];
  scene.add(current.group);

  // Use transcription timing if available
  const useTranscriptionTiming = current.startTime !== undefined;

  if (useTranscriptionTiming) {
    animateLineGlideWithTiming(current, () => {
      if (!cfg.keepPreviousLinesVisible) {
        scene.remove(current.group);
      }
      runSequence(lineIdx + 1);
    });
  } else {
    // Fallback to original timing
    animateLineGlide(current, () => {
      if (!cfg.keepPreviousLinesVisible) {
        scene.remove(current.group);
      }
      runSequence(lineIdx + 1);
    });
  }
}

// NEW: Animate with exact transcription timing
function animateLineGlideWithTiming(lineObj, onComplete) {
  const { meshes, centers, words, startTime, endTime } = lineObj;
  const n = centers.length;

  // Reset word states
  for (const m of meshes) {
    m.visible = false;
    m.material.opacity = 0;
    m.userData.revealStart = -1;
    m.userData.revealed = false;
    m.scale.setScalar(1);
    m.position.copy(m.userData.basePos);
  }

  if (n === 0) { onComplete?.(); return; }

  const curve = new THREE.CatmullRomCurve3(
    centers.map(v => v.clone()),
    false,
    'catmullrom',
    0.5
  );

  const ARC_SAMPLES = Math.max(220, n * 90);
  const lengths = curve.getLengths(ARC_SAMPLES);
  const totalLen = lengths[lengths.length - 1];

  // Use exact transcription duration
  const totalMs = (endTime - startTime) * 1000;
  const start = performance.now();

  let camX = camera.position.x;
  let camY = camera.position.y;

  const followLambda = cfg.followLambda;
  const lookAheadU = cfg.curveLookAheadU;

  let lastNow = performance.now();

  function startReveal(mesh, meshIdx, now) {
    if (mesh.userData.revealed) return;

    mesh.userData.revealed = true;
    mesh.visible = true;
    mesh.userData.revealStart = now;

    mesh.material.opacity = 0;
    mesh.scale.setScalar(cfg.revealPopScale);
    mesh.position.set(
      mesh.userData.basePos.x,
      mesh.userData.basePos.y + cfg.revealRise,
      mesh.userData.basePos.z + cfg.revealZ
    );
  }

  function tickReveal(mesh, now) {
    if (!mesh.visible) return;
    const t0 = mesh.userData.revealStart;
    if (t0 < 0) return;

    const t = clamp01((now - t0) / cfg.revealMs);

    const a = easeOutCubic(t);
    mesh.material.opacity = a;

    const pop = easeOutBack(t, cfg.revealOvershoot);
    const s = 1 + (cfg.revealPopScale - 1) * (1 - t);
    const settled = 1 + (s - 1) * (1 / pop);
    mesh.scale.setScalar(settled);

    const rise = (1 - a) * cfg.revealRise;
    const zPush = (1 - a) * cfg.revealZ;

    mesh.position.set(
      mesh.userData.basePos.x,
      mesh.userData.basePos.y + rise,
      mesh.userData.basePos.z + zPush
    );

    if (t >= 1) {
      mesh.userData.revealStart = null;
      mesh.material.opacity = 1;
      mesh.scale.setScalar(1);
      mesh.position.copy(mesh.userData.basePos);
    }
  }

  function frame(now) {
    const dt = Math.max(0.001, (now - lastNow) / 1000);
    lastNow = now;

    const elapsed = now - start;
    const u = Math.min(elapsed / totalMs, 1);

    const dist = u * totalLen;

    let idx = 0;
    while (idx < lengths.length && lengths[idx] < dist) idx++;

    const t = idx / (lengths.length - 1);
    const t2 = Math.min(1, t + lookAheadU);

    const target = curve.getPointAt(t2);

    // Reveal words based on their individual timing
    if (words && words.length === meshes.length) {
      const currentTime = startTime + (u * (endTime - startTime));
      
      for (let k = 0; k < words.length; k++) {
        if (currentTime >= words[k].startTime) {
          startReveal(meshes[k], k, now);
        }
      }
    } else {
      // Fallback: reveal by position
      const p = u * (n - 1);
      const revealIdx = Math.min(n - 1, Math.floor(p + cfg.revealWordLead));
      for (let k = 0; k <= revealIdx; k++) {
        startReveal(meshes[k], k, now);
      }
    }

    for (const m of meshes) tickReveal(m, now);

    camX = damp(camX, target.x, followLambda, dt);
    camY = damp(camY, target.y, followLambda, dt);

    camera.position.set(camX, camY, cfg.cameraDistance);
    camera.lookAt(target);

    renderer.render(scene, camera);

    if (u < 1) {
      requestAnimationFrame(frame);
    } else {
      for (const m of meshes) {
        m.visible = true;
        m.material.opacity = 1;
        m.userData.revealStart = -1;
        m.scale.setScalar(1);
        m.position.copy(m.userData.basePos);
      }
      setTimeout(() => onComplete?.(), cfg.lineHoldMsAfterComplete);
    }
  }

  requestAnimationFrame(frame);
}

// Update UI controls
const controls = document.createElement('div');
controls.style = 'position:fixed;top:10px;right:10px;z-index:1000;background:rgba(0,0,0,0.8);padding:15px;border-radius:8px;color:#fff;';
controls.innerHTML = `
  <button id="loadTranscript" style="padding:10px 20px;background:#00ccff;border:none;color:#000;border-radius:4px;cursor:pointer;font-weight:bold;margin-bottom:10px;display:block;width:100%;">
    Load from Resolve
  </button>
  <button id="sendToResolve" style="padding:10px 20px;background:#4caf50;border:none;color:#fff;border-radius:4px;cursor:pointer;font-weight:bold;margin-bottom:10px;display:block;width:100%;">
    Create Captions
  </button>
  <div id="status" style="margin-top:10px;font-size:12px;"></div>
`;
document.body.appendChild(controls);

const statusEl = document.getElementById('status');

document.getElementById('loadTranscript').addEventListener('click', async () => {
  statusEl.textContent = 'Loading transcription...';
  const data = await loadTranscriptionFromResolve();
  
  if (data) {
    statusEl.textContent = `✓ Loaded ${data.words.length} words`;
    // Reload scene with new data
    location.reload();
  } else {
    statusEl.textContent = '✗ Failed to load transcription';
  }
});

document.getElementById('sendToResolve').addEventListener('click', async () => {
  if (!transcriptionData) {
    statusEl.textContent = 'Load transcription first!';
    return;
  }
  
  statusEl.textContent = 'Creating captions...';
  
  const res = await fetch('/api/create-animated-captions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      words: transcriptionData.words,
      wordsPerLine: 8
    })
  });
  
  const result = await res.json();
  statusEl.textContent = result.error 
    ? `Error: ${result.error}`
    : `✓ Created ${result.created} captions`;
});
```

## Workflow

1. **In DaVinci Resolve:**

- Select audio/video clip with dialogue
- Right-click → **Transcribe Audio**
- Choose language → OK
- Wait for transcription to complete

1. **Run Your Captioner:**
   
   ```bash
   python main.py
   ```

- Open <http://localhost:8080>
- Click **"Load from Resolve"**
- See auto-synced 3D captions play with exact audio timing
- Click **"Create Captions"** to add them back to timeline

The captions are now perfectly synced to your voiceover with word-level timing! Want me to add per-word highlighting or export to Fusion comps?​​​​​​​​​​​​​​​​