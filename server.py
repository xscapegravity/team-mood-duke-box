import os
import json
import random
import string
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
import socketio
import uvicorn
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

# Configure Gemini
genai.configure(apiKey=os.getenv("GEMINI_API_KEY"))

app = FastAPI()
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
socket_app = socketio.ASGIApp(sio, app)

# Shared state
state = {
    "moods": [],
    "isDone": False,
    "suggestedSong": None
}

@sio.event
async def connect(sid, environ):
    print(f"User connected: {sid}")
    await sio.emit('state-update', state, to=sid)

@sio.event
async def disconnect(sid):
    print(f"User disconnected: {sid}")

@sio.on('add-mood')
async def handle_add_mood(sid, data):
    if state["isDone"]:
        return
    
    new_mood = {
        "id": ''.join(random.choices(string.ascii_lowercase + string.digits, k=9)),
        "user": data.get("user", "Anonymous"),
        "mood": data.get("mood", "")
    }
    state["moods"].append(new_mood)
    await sio.emit('state-update', state)

@sio.on('set-done')
async def handle_set_done(sid, song_data):
    state["isDone"] = True
    state["suggestedSong"] = song_data
    await sio.emit('state-update', state)

@sio.on('reset')
async def handle_reset(sid):
    state["moods"] = []
    state["isDone"] = False
    state["suggestedSong"] = None
    await sio.emit('state-update', state)

# API Route for Gemini (Server-side)
@app.post("/api/generate-song")
async def generate_song(request: Request):
    data = await request.json()
    moods_list = data.get("moods", [])
    moods_text = "\n".join([f"{m['user']}: {m['mood']}" for m in moods_list])
    
    prompt = f"""The following is a list of moods from a team:
{moods_text}

Based on these collective moods, find one specific REAL song that perfectly represents the team's current vibe.

CRITICAL INSTRUCTIONS:
1. Suggest a REAL song with title and artist.
2. Provide a short reason why this song fits.
3. Find a likely YouTube Video ID for this song (11 characters).
4. Return the response in RAW JSON format with keys: "title", "artist", "reason", "youtubeId"."""
    
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        # Use a simple generation for now, as search tool in python SDK 
        # might require specific setup not available here.
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        song_info = json.loads(response.text.strip())
        return song_info
    except Exception as e:
        print(f"Error generating song: {e}")
        # Fallback
        return {
            "title": "Happy",
            "artist": "Pharrell Williams",
            "reason": "Couldn't generate a custom song, but let's stay positive!",
            "youtubeId": "ZbZSe6N_BXs"
        }

# Serve static files
dist_path = os.path.join(os.getcwd(), "dist")

if os.path.exists(dist_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_path, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(dist_path, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(dist_path, "index.html"))
else:
    @app.get("/")
    async def root():
        return {"message": "Dist folder not found. Please run npm build."}

if __name__ == "__main__":
    uvicorn.run(socket_app, host="0.0.0.0", port=3000)
