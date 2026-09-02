#!/usr/bin/env python3
"""Batch card-art generator for Ludo.ai.

Usage:
  LUDO_API_KEY=... python3 ludo_gen.py MANIFEST.json OUTDIR [--only id1,id2] [--style-image URL_OR_PATH] [--concurrency N]

Manifest: {"defaults": {"image_type": "card-art", "art_style": "...", "aspect_ratio": "ar_3_4"},
           "jobs": [{"id": "...", "request_id": "...", "prompt": "...", "art_style": "...", ...}]}
Each job uses a stable request_id so retries never double-charge. Already-downloaded ids are skipped.
"""
import base64, json, mimetypes, os, sys, time, urllib.error, urllib.request

API = "https://api.ludo.ai/api"
KEY = os.environ["LUDO_API_KEY"]
HDR = {"Authorization": f"ApiKey {KEY}", "Content-Type": "application/json", "Accept": "application/json"}

def call(method, path, body=None, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method, headers=HDR)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            txt = r.read().decode()
            return r.status, (json.loads(txt) if txt else {})
    except urllib.error.HTTPError as e:
        txt = e.read().decode(errors="replace")
        try: return e.code, json.loads(txt)
        except Exception: return e.code, {"raw": txt}

def load_style_image(ref):
    if not ref: return None
    if ref.startswith("http"): return ref
    with open(ref, "rb") as f:
        mt = mimetypes.guess_type(ref)[0] or "image/png"
        return f"data:{mt};base64," + base64.b64encode(f.read()).decode()

def submit(job, defaults, style_image):
    body = {"prompt": job["prompt"],
            "image_type": job.get("image_type", defaults.get("image_type", "card-art")),
            "n": 1, "async": True, "request_id": job["request_id"],
            "augment_prompt": job.get("augment_prompt", defaults.get("augment_prompt", True))}
    if style_image:
        body["style_image"] = style_image
        path = "/assets/image/style"
    else:
        body["art_style"] = job.get("art_style", defaults.get("art_style", "Any style"))
        body["aspect_ratio"] = job.get("aspect_ratio", defaults.get("aspect_ratio", "ar_3_4"))
        persp = job.get("perspective", defaults.get("perspective"))
        if persp: body["perspective"] = persp
        path = "/assets/image"
    for attempt in range(6):
        code, resp = call("POST", path, body)
        if code in (200, 202): return code, resp
        if code in (429, 503) or (code == 400 and "simultaneous" in json.dumps(resp).lower()):
            time.sleep(15 * (attempt + 1)); continue
        return code, resp
    return code, resp

def extract_url(result):
    if isinstance(result, list) and result: return extract_url(result[0])
    if isinstance(result, dict):
        if result.get("url"): return result["url"]
        for k in ("images", "results", "data", "result"):
            if k in result: return extract_url(result[k])
    return None

def poll(job_id):
    while True:
        code, resp = call("GET", f"/assets/jobs/{job_id}?wait=30", timeout=90)
        if code != 200: return {"status": "failed", "error": resp}
        st = resp.get("status")
        if st in ("succeeded", "failed", "canceled"): return resp
        time.sleep(max(1, resp.get("poll_after_ms", 3000) / 1000))

def download(url, dest_base):
    req = urllib.request.Request(url, headers={"User-Agent": "curl/8"})
    with urllib.request.urlopen(req, timeout=120) as r:
        ct = r.headers.get("Content-Type", "")
        ext = ".png" if "png" in ct else ".jpg" if "jpe" in ct else ".webp" if "webp" in ct else os.path.splitext(url.split("?")[0])[1] or ".png"
        data = r.read()
    path = dest_base + ext
    with open(path, "wb") as f: f.write(data)
    return path

def main():
    args = sys.argv[1:]
    manifest_path, outdir = args[0], args[1]
    only = None; style_ref = None; conc = 3
    for i, a in enumerate(args):
        if a == "--only": only = set(args[i+1].split(","))
        if a == "--style-image": style_ref = args[i+1]
        if a == "--concurrency": conc = int(args[i+1])
    os.makedirs(outdir, exist_ok=True)
    man = json.load(open(manifest_path))
    defaults = man.get("defaults", {})
    style_image = load_style_image(style_ref)
    results_path = os.path.join(outdir, "results.json")
    results = json.load(open(results_path)) if os.path.exists(results_path) else {}
    jobs = [j for j in man["jobs"] if (only is None or j["id"] in only)]
    jobs = [j for j in jobs if not (results.get(j["id"], {}).get("file") and os.path.exists(results[j["id"]]["file"]))]
    print(f"{len(jobs)} jobs to run (concurrency {conc}, style_image={'yes' if style_image else 'no'})", flush=True)
    for w in range(0, len(jobs), conc):
        wave = jobs[w:w+conc]; pending = []
        for j in wave:
            code, resp = submit(j, defaults, style_image)
            if code == 200:  # synchronous result
                url = extract_url(resp)
                results[j["id"]] = {"request_id": j["request_id"], "url": url, "status": "succeeded"}
                if url: results[j["id"]]["file"] = download(url, os.path.join(outdir, j["id"]))
                print(f"  done  {j['id']} (sync) -> {results[j['id']].get('file')}", flush=True)
            elif code == 202:
                pending.append((j, resp["id"])); print(f"  queued {j['id']} job={resp['id']}", flush=True)
            else:
                results[j["id"]] = {"request_id": j["request_id"], "status": "submit_failed", "error": resp, "http": code}
                print(f"  FAILED submit {j['id']}: {code} {json.dumps(resp)[:300]}", flush=True)
            json.dump(results, open(results_path, "w"), indent=1)
        for j, jid in pending:
            resp = poll(jid)
            rec = {"request_id": j["request_id"], "job_id": jid, "status": resp.get("status"),
                   "credits": resp.get("credits_charged"), "error": resp.get("error")}
            if resp.get("status") == "succeeded":
                url = extract_url(resp.get("result")); rec["url"] = url
                if url:
                    try: rec["file"] = download(url, os.path.join(outdir, j["id"]))
                    except Exception as e: rec["download_error"] = str(e)
                print(f"  done  {j['id']} -> {rec.get('file')}  credits={rec['credits']}", flush=True)
            else:
                print(f"  FAILED {j['id']}: {json.dumps(resp)[:400]}", flush=True)
            results[j["id"]] = rec
            json.dump(results, open(results_path, "w"), indent=1)
    ok = sum(1 for r in results.values() if r.get("file"))
    print(f"finished: {ok} images downloaded, {len(results)-ok} without file", flush=True)

if __name__ == "__main__":
    main()
