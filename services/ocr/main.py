"""
EasyOCR microservice
────────────────────
A lightweight FastAPI server that accepts an image and returns extracted text
using EasyOCR.  Designed to run alongside the Next.js app on localhost.

Start:
    cd services/ocr
    pip install -r requirements.txt
    python main.py          # runs on http://localhost:8100

The /ocr endpoint returns:
    {
      "text": "full concatenated text",
      "lines": [
        {"text": "...", "confidence": 0.95, "bbox": [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]}
      ]
    }
"""

from __future__ import annotations

import io
import os
import logging

import easyocr
import numpy as np
from PIL import Image
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ocr-service")

# ── EasyOCR reader (lazy-initialised on first request) ────────────────────────
_reader: easyocr.Reader | None = None

LANGUAGES = os.getenv("OCR_LANGUAGES", "en").split(",")


def get_reader() -> easyocr.Reader:
    global _reader
    if _reader is None:
        logger.info("Initialising EasyOCR reader (languages=%s) …", LANGUAGES)
        _reader = easyocr.Reader(LANGUAGES, gpu=False)
        logger.info("EasyOCR reader ready.")
    return _reader


# ── FastAPI app ───────────────────────────────────────────────────────────────

import cv2
import json

app = FastAPI(title="Ingredient Scanner – OCR Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "ok"}

def order_points(pts):
    # Sorts the 4 points based on their x and y coordinates
    # to find top-left, top-right, bottom-right, bottom-left
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect

def four_point_transform(image, pts):
    rect = order_points(pts)
    (tl, tr, br, bl) = rect
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))

    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))

    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]], dtype="float32")

    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))
    return warped

from fastapi import Form

@app.post("/ocr")
async def extract_text(
    image: UploadFile = File(...),
    coordinates: str | None = Form(None)
):
    """Accept an image file, optionally warp it, and return OCR-extracted text."""
    try:
        contents = await image.read()
        img = Image.open(io.BytesIO(contents)).convert("RGB")
        img_np = np.array(img)

        if coordinates:
            try:
                # coordinates should be JSON array of 4 points: [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
                pts = json.loads(coordinates)
                if len(pts) == 4:
                    pts_np = np.array(pts, dtype="float32")
                    img_np = four_point_transform(img_np, pts_np)
                    logger.info("Applied 4-point perspective transform")
            except Exception as e:
                logger.warning("Failed to apply perspective transform: %s", e)

        reader = get_reader()
        # detail=0 returns a simple list of text strings, paragraph=True groups them nicely
        results = reader.readtext(img_np, detail=0, paragraph=True)

        # Join the grouped text with newlines to preserve spatial vertical separation
        full_text = "\n".join(results)
        
        # We don't have detailed lines/bboxes anymore, which is fine since we just need the text
        logger.info("OCR extracted %d text paragraphs (%d chars)", len(results), len(full_text))

        return {"text": full_text, "lines": []}

    except Exception as e:
        logger.exception("OCR processing failed")
        return JSONResponse(
            status_code=500,
            content={"error": "OCR processing failed", "details": str(e)},
        )


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("OCR_PORT", "8100"))
    logger.info("Starting OCR service on port %d", port)
    uvicorn.run(app, host="0.0.0.0", port=port)
