import os
import time
from threading import Lock
from flask import Flask, jsonify
from flask_socketio import SocketIO, join_room, leave_room, emit
from flask_cors import CORS
from transformers import pipeline, AutoTokenizer, AutoModelForSeq2SeqLM
import torch

# Initialize Flask app
app = Flask(__name__)
CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173"])

# Need to use specific async_mode if eventlet/gevent are installed, 
# 'threading' is easiest for minimal setup without gevent but less performant. 
# We'll rely on default which auto-detects gevent if installed.
socketio = SocketIO(app, cors_allowed_origins=["http://localhost:5173", "http://127.0.0.1:5173"], async_mode='gevent')

print("\n⚙️ Loading NLLB-200-distilled-1.3B model... (This will take a few minutes the first time)")
model_name = "facebook/nllb-200-distilled-1.3B"

# Determine device (cuda if GPU available, else cpu)
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"🖥️ Using compute device: {device.upper()}")

# Load model and tokenizer
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSeq2SeqLM.from_pretrained(model_name).to(device)

print("✅ Model loaded successfully!")

# Translation Pipeline Helper
# NLLB uses BCP-47 codes (e.g., 'spa_Latn' for Spanish, 'eng_Latn' for English)
lang_map = {
    'es': 'spa_Latn',
    'en': 'eng_Latn'
}

def translate_text(text, source_lang, target_lang):
    if source_lang == target_lang or not text.strip():
        return text
    
    src_lang_code = lang_map.get(source_lang, 'eng_Latn')
    tgt_lang_code = lang_map.get(target_lang, 'eng_Latn')
    
    print(f"🔄 Translating: '{text}' ({src_lang_code} -> {tgt_lang_code})")
    
    # Tokenize with source language
    tokenizer.src_lang = src_lang_code
    inputs = tokenizer(text, return_tensors="pt").to(device)
    
    # Generate translation
    # Get the language token id for the target language
    forced_bos_token_id = tokenizer.lang_code_to_id[tgt_lang_code]
    
    with torch.no_grad():
        translated_tokens = model.generate(
            **inputs, 
            forced_bos_token_id=forced_bos_token_id, 
            max_length=200
        )
        
    translation = tokenizer.batch_decode(translated_tokens, skip_special_tokens=True)[0]
    return translation


# In-memory state
rooms = {}  # roomId -> set of socketIds
users = {}  # socketId -> { id, username, language, roomId }
rooms_lock = Lock()

@app.route('/api/health')
def health_check():
    return jsonify({'status': 'ok', 'rooms': len(rooms), 'users': len(users)})

@socketio.on('connect')
def handle_connect():
    from flask import request
    print(f"✦ User connected: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    from flask import request
    socket_id = request.sid
    with rooms_lock:
        user = users.pop(socket_id, None)
        if user:
            room_id = user['roomId']
            if room_id in rooms and socket_id in rooms[room_id]:
                rooms[room_id].remove(socket_id)
                if not rooms[room_id]:
                    del rooms[room_id]
                else:
                    # Broadcast updated user list
                    room_users = [users[uid] for uid in rooms[room_id] if uid in users]
                    emit('room-users', room_users, to=room_id)
                    emit('system-message', {
                        'text': f"{user['username']} salió de la sala / left the room",
                        'timestamp': int(time.time() * 1000)
                    }, to=room_id)
            print(f"✖ {user['username']} disconnected")

@socketio.on('join-room')
def handle_join_room(data):
    from flask import request
    socket_id = request.sid
    username = data.get('username')
    language = data.get('language')
    room_id = data.get('roomId')
    
    user = {
        'id': socket_id,
        'username': username,
        'language': language,
        'roomId': room_id
    }
    
    with rooms_lock:
        users[socket_id] = user
        if room_id not in rooms:
            rooms[room_id] = set()
        rooms[room_id].add(socket_id)
        
    join_room(room_id)
    
    with rooms_lock:
        room_users = [users[uid] for uid in rooms[room_id] if uid in users]
        
    emit('room-users', room_users, to=room_id)
    emit('system-message', {
        'text': f"{username} se unió a la sala / joined the room",
        'timestamp': int(time.time() * 1000)
    }, to=room_id)
    
    print(f"→ {username} ({language}) joined room '{room_id}'")

@socketio.on('voice-message')
def handle_voice_message(data):
    from flask import request
    socket_id = request.sid
    text = data.get('text')
    from_lang = data.get('fromLang')
    
    user = users.get(socket_id)
    if not user:
        return
        
    room_id = user['roomId']
    
    # Collect unique target languages in the room
    target_langs = set()
    with rooms_lock:
        if room_id in rooms:
            for uid in rooms[room_id]:
                room_user = users.get(uid)
                if room_user and room_user['language'] != from_lang:
                    target_langs.add(room_user['language'])
                    
    translations = {from_lang: text}
    
    # Process translations sequentially (could be parallelized with workers)
    for target_lang in target_langs:
        try:
            translations[target_lang] = translate_text(text, from_lang, target_lang)
        except Exception as e:
            print(f"Error translating: {e}")
            translations[target_lang] = text  # fallback to original
            
    emit('translated-message', {
        'userId': socket_id,
        'username': user['username'],
        'originalText': text,
        'originalLang': from_lang,
        'translations': translations,
        'timestamp': int(time.time() * 1000)
    }, to=room_id)
    
    print(f"💬 {user['username']}: '{text}' -> {translations}")

@socketio.on('typing')
def handle_typing(is_typing):
    from flask import request
    user = users.get(request.sid)
    if user:
        emit('user-typing', {
            'userId': request.sid,
            'username': user['username'],
            'isTyping': is_typing
        }, to=user['roomId'], include_self=False)

if __name__ == '__main__':
    print("\n🌐 Starting Server on port 5000...")
    socketio.run(app, host='0.0.0.0', port=5000, debug=False)
