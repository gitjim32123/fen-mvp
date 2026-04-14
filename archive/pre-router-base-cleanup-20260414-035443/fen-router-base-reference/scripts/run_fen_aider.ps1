$ErrorActionPreference = 'Stop'
$repo = 'D:\FEN!\fen-mvp\fen-router-base'
$env:OLLAMA_API_BASE = 'http://127.0.0.1:11434'
Start-Process -WindowStyle Minimized -FilePath 'powershell' -ArgumentList '-NoExit','-Command','ollama serve'
Start-Sleep -Seconds 4
Set-Location $repo
if (-not (Test-Path .\FEN_PROMPT.txt)) {
@'
Read these source-of-truth files first:
- FEN_Master_Build_Proof_Handoff.pdf
- FEN_UI_Screen_Design_Spec.pdf
- FEN_Browse_Map_Addendum.pdf
- FEN_Brand_and_Positioning_Pack.pdf

Task:
Fix this Expo Router FEN app from the existing codebase, not from scratch.

Rules:
- Do not invent routes, schema fields, or business rules.
- Remove placeholder screens and extra bottom tabs.
- Match the route structure in the handoff.
- Keep the dark violet FEN style and simple accessible UI.
- Browse must include a top map preview and job cards with travel time.
- Wire real Supabase data where possible.
- Work one file at a time and keep the app compiling after each change.
- First, tell me which files you will change before editing.
'@ | Set-Content .\FEN_PROMPT.txt
}
aider --model ollama_chat/qwen2.5-coder:7b --message-file .\FEN_PROMPT.txt
