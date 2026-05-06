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


@app.post("/ocr")
async def extract_text(image: UploadFile = File(...)):
    """Accept an image file and return OCR-extracted text."""
    try:
        contents = await image.read()
        img = Image.open(io.BytesIO(contents)).convert("RGB")
        img_np = np.array(img)

        reader = get_reader()
        results = reader.readtext(img_np, detail=1, paragraph=False)

        lines = []
        text_parts = []
        for bbox, text, conf in results:
            text_parts.append(text)
            lines.append({
                "text": text,
                "confidence": round(float(conf), 4),
                "bbox": [[int(c) for c in pt] for pt in bbox],
            })

        full_text = " ".join(text_parts)
        logger.info("OCR extracted %d text segments (%d chars)", len(lines), len(full_text))

        return {"text": full_text, "lines": lines}

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
