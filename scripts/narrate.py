#!/usr/bin/env python3
"""Generate narration clips with Ludo.ai preset voices.
Usage: LUDO_API_KEY=... python3 scripts/narrate.py video/scripts/tutorial.md video/out/narration [--voice "Friendly man"]
Reads the markdown table (| # | shot | narration | s |), writes NN.mp3 + manifest.json (durations)."""
import json, os, re, sys, time, urllib.request, urllib.error

API = "https://api.ludo.ai/api"; KEY = os.environ["LUDO_API_KEY"]
HDR = {"Authorization": f"ApiKey {KEY}", "Content-Type": "application/json", "Accept": "application/json"}
src, out = sys.argv[1], sys.argv[2]
voice = sys.argv[sys.argv.index("--voice") + 1] if "--voice" in sys.argv else "Friendly man"
os.makedirs(out, exist_ok=True)

def call(method, path, body=None, timeout=180):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body else None, method=method, headers=HDR)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        txt = e.read().decode(errors="replace")
        try: return e.code, json.loads(txt)
        except Exception: return e.code, {"raw": txt}

lines = []
for row in open(src):
    m = re.match(r"^\|\s*(\d+)\s*\|[^|]*\|\s*\*?(.*?)\*?\s*\|\s*(\d+)\s*\|\s*$", row.strip())
    if m: lines.append((int(m.group(1)), m.group(2).strip().strip("*"), int(m.group(3))))
manifest = json.load(open(os.path.join(out, "manifest.json"))) if os.path.exists(os.path.join(out, "manifest.json")) else {}
for n, text, secs in lines:
    key = f"{n:02d}"
    if key in manifest and os.path.exists(manifest[key]["file"]): print("skip", key); continue
    body = {"text": text, "voice_preset_id": voice, "emotion": "Default", "language": "English", "request_id": f"atwd-narr-{os.path.basename(src)}-{key}-v1", "async": True}
    code, resp = call("POST", "/audio/speech-preset", body)
    if code == 202:
        jid = resp["id"]
        while True:
            c2, st = call("GET", f"/assets/jobs/{jid}?wait=30", timeout=90)
            if st.get("status") in ("succeeded", "failed", "canceled"): break
            time.sleep(2)
        if st.get("status") != "succeeded": print("FAILED", key, json.dumps(st)[:300]); continue
        resp = st["result"]
    elif code != 200: print("FAILED submit", key, code, json.dumps(resp)[:300]); continue
    url = resp.get("url") if isinstance(resp, dict) else None
    if not url: print("no url", key, json.dumps(resp)[:200]); continue
    dest = os.path.join(out, f"{key}.mp3")
    with urllib.request.urlopen(url, timeout=120) as r, open(dest, "wb") as f: f.write(r.read())
    manifest[key] = {"file": dest, "text": text, "duration": resp.get("duration"), "planned": secs}
    json.dump(manifest, open(os.path.join(out, "manifest.json"), "w"), indent=1)
    print("done", key, resp.get("duration"), "s")
print(f"{len(manifest)} clips in {out}")
