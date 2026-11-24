#!/usr/bin/env python3
"""Measures photos so a blurry, dark or tiny one cannot be used. Usage: python3 photo-check.py [--hero] file...   Prints one JSON object per line.
Needs Pillow and numpy (python3 -m pip install pillow numpy). Faces are reported only when OpenCV is installed, otherwise "faces": null.
What it can and cannot see: it catches soft/blurry, dark and too-small photos. It cannot tell a boring close-up (bread crumb texture) from a good photo; that is the reviewer's and the anchors' job."""
import sys, json
try:
    import numpy as np
    from PIL import Image
except Exception as e:
    print(json.dumps({"error": "needs Pillow and numpy: python3 -m pip install pillow numpy (%s)" % e})); sys.exit(3)
hero = "--hero" in sys.argv
files = [a for a in sys.argv[1:] if not a.startswith("--")]
try:
    import cv2
    casc = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
except Exception:
    cv2 = None; casc = None
for f in files:
    out = {"file": f}
    try:
        im = Image.open(f).convert("RGB"); w, h = im.size
        g = im.convert("L"); s = 800.0 / max(w, h)
        if s < 1: g = g.resize((max(1, int(w * s)), max(1, int(h * s))), Image.LANCZOS)
        a = np.asarray(g, dtype=float)
        lap = np.abs(-4 * a[1:-1, 1:-1] + a[:-2, 1:-1] + a[2:, 1:-1] + a[1:-1, :-2] + a[1:-1, 2:])
        sharp = float(np.percentile(lap, 99)); bright = float(a.mean())
        out.update({"w": w, "h": h, "sharp": round(sharp, 1), "bright": round(bright)})
        faces = None
        if casc is not None:
            arr = np.asarray(g, dtype="uint8"); found = casc.detectMultiScale(arr, 1.2, 5, minSize=(40, 40)); faces = int(len(found))
        out["faces"] = faces
        problems = []
        if min(w, h) < (900 if hero else 600): problems.append("too small (%dx%d, needs the short side at least %d pixels)" % (w, h, 900 if hero else 600))
        if bright < (85 if hero else 45): problems.append("too dark (brightness %d of 255, needs at least %d)" % (bright, 85 if hero else 45))
        if sharp < (80 if hero else 50): problems.append("soft or blurry (sharpness %.0f, needs at least %d)" % (sharp, 80 if hero else 50))
        out["problems"] = problems
    except Exception as e:
        out["problems"] = ["cannot be read as an image (%s)" % e]
    print(json.dumps(out))
