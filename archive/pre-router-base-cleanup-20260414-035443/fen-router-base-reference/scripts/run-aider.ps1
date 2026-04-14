Set-Location "D:\FEN!\fen-mvp\fen-router-base"
$env:OLLAMA_API_BASE = "http://127.0.0.1:11434"
aider --model ollama_chat/qwen2.5-coder:7b
