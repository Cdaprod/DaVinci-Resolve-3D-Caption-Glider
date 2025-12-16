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
