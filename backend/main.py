import asyncio
import tempfile
import os
import time
import json
import csv
import subprocess

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from birdnet_analyzer.analyze import analyze

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MIN_CONFIDENCE = 0.1


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    print("Client connected")
    output_dir = tempfile.mkdtemp()

    try:
        while True:
            data = await ws.receive_bytes()
            await process_audio(data, output_dir, ws)

    except WebSocketDisconnect:
        print("Client disconnected")


@app.get("/")
def root():
    return {"status": "AvianEar running"}


def convert_to_wav(webm_bytes: bytes) -> str:
    webm_tmp = tempfile.NamedTemporaryFile(suffix=".webm", delete=False)
    webm_tmp.write(webm_bytes)
    webm_tmp.close()

    wav_path = webm_tmp.name.replace(".webm", ".wav")

    result = subprocess.run([
        "ffmpeg", "-y",
        "-i", webm_tmp.name,
        "-ar", "48000",
        "-ac", "1",
        "-sample_fmt", "s16",
        wav_path
    ], capture_output=True)

    os.unlink(webm_tmp.name)

    if not os.path.exists(wav_path) or os.path.getsize(wav_path) < 1000:
        raise ValueError("ffmpeg produced invalid WAV file")

    return wav_path


def run_birdnet(wav_path: str, output_dir: str):
    analyze(
        audio_input=wav_path,
        output=output_dir,
        min_conf=MIN_CONFIDENCE,
        rtype="csv",
    )


def parse_results(output_dir: str, wav_path: str) -> list:
    detections = []
    base = os.path.splitext(os.path.basename(wav_path))[0]
    csv_path = os.path.join(output_dir, base + ".BirdNET.results.csv")

    if not os.path.exists(csv_path):
        return detections

    with open(csv_path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get("Common name", "Unknown")
            if name.lower() in ["human vocal", "engine", "wind", "rain", "noise"]:
                continue
            detections.append({
                "common_name": name,
                "scientific_name": row.get("Scientific name", ""),
                "confidence": round(float(row.get("Confidence", 0)) * 100, 1),
            })

    return detections


async def process_audio(audio_bytes: bytes, output_dir: str, ws: WebSocket):
    wav_path = None
    try:
        loop = asyncio.get_event_loop()

        wav_path = await loop.run_in_executor(None, convert_to_wav, audio_bytes)

        import wave
        with wave.open(wav_path, "rb") as wf:
            raw = wf.readframes(wf.getnframes())
            samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32)
            rms = np.sqrt(np.mean(samples ** 2)) if len(samples) > 0 else 0

        if rms < 200:
            print("Silent chunk, skipping")
            return

        await loop.run_in_executor(None, run_birdnet, wav_path, output_dir)
        detections = parse_results(output_dir, wav_path)

        for det in detections:
            try:
                await ws.send_text(json.dumps({
                    "type": "detection",
                    "id": str(time.time()),
                    "common_name": det["common_name"],
                    "scientific_name": det["scientific_name"],
                    "confidence": det["confidence"],
                    "timestamp": time.strftime("%H:%M:%S"),
                }))
                print(f"Bird: {det['common_name']} ({det['confidence']}%)")
            except Exception:
                pass

        if not detections:
            print("No birds detected in chunk")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        if wav_path:
            try:
                os.unlink(wav_path)
            except Exception:
                pass