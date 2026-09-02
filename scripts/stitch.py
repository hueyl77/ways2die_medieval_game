#!/usr/bin/env python3
"""Stitch narration + recorded shots into a rough first cut.
Usage: python3 scripts/stitch.py video/out/narration video/out/shots video/out/first-cut.mp4
Each narration clip NN.mp3 is paired with a shot (see MAP); the shot is trimmed/held to the narration length."""
import json, os, subprocess, sys, tempfile
narr_dir, shots_dir, out = sys.argv[1], sys.argv[2], sys.argv[3]
W, H = 1920, 1080
FONT = next((f for f in ["/System/Library/Fonts/Supplemental/Georgia.ttf", "/Library/Fonts/Georgia.ttf", "/System/Library/Fonts/Supplemental/Times New Roman.ttf"] if os.path.exists(f)), None)
# narration number -> (shot file, start offset seconds) ; 'title'/'end' are generated cards
MAP = {1: ("title", 0), 2: ("01-hand.mp4", 0), 3: ("03-reveal.mp4", 6), 4: ("01-hand.mp4", 2), 5: ("02-place.mp4", 0), 6: ("03-reveal.mp4", 0),
       7: ("03-reveal.mp4", 14), 8: ("01-hand.mp4", 5), 9: ("04-funeral.mp4", 0), 10: ("05-end.mp4", 2), 11: ("end", 0)}
CARDS = {"title": ["A Million Ways to Die in Medieval", "Honest trades, unfortunate accidents"], "end": ["A Million Ways to Die in Medieval", "Gather three to eight friends. Try not to die."]}
man = json.load(open(os.path.join(narr_dir, "manifest.json")))
timing_path = os.path.join(shots_dir, "timing.json")   # page-load lead-in per shot, written by record-demo.ts
lead = json.load(open(timing_path)) if os.path.exists(timing_path) else {}
def dur(path):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]).decode().strip() or 0)
tmp = tempfile.mkdtemp(); parts = []
for n in sorted(MAP):
    key = f"{n:02d}"; audio = man.get(key, {}).get("file")
    if not audio or not os.path.exists(audio): print("no narration for", key); continue
    length = dur(audio) + 0.7
    src, start = MAP[n]; part = os.path.join(tmp, f"{key}.mp4")
    if src in CARDS:
        card = os.path.join(os.path.dirname(shots_dir.rstrip('/')), "cards", f"{src}.png")   # rendered by scripts/title-cards.ts
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-framerate", "30", "-t", f"{length:.2f}", "-i", card, "-i", audio, "-vf", f"scale={W}:{H},format=yuv420p", "-c:v", "libx264", "-c:a", "aac", "-shortest", part]
    else:
        clip = os.path.join(shots_dir, src)
        if not os.path.exists(clip): print("missing shot", src); continue
        start = start + lead.get(src.replace('.mp4', ''), 0)
        # hold the last frame if the clip is shorter than the narration
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-ss", str(start), "-i", clip, "-i", audio, "-filter_complex", f"[0:v]tpad=stop_mode=clone:stop_duration={length:.2f},trim=duration={length:.2f},setpts=PTS-STARTPTS,scale={W}:{H}[v]", "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-shortest", part]
    subprocess.run(cmd, check=True); parts.append(part); print("part", key, f"{length:.1f}s", src)
lst = os.path.join(tmp, "list.txt")
open(lst, "w").write("".join(f"file '{p}'\n" for p in parts))
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", "-movflags", "+faststart", out], check=True)
print("wrote", out, f"{dur(out):.1f}s")
