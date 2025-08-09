### Neon Terminal · Ollama PWA

A minimal, retro-cyberpunk chat UI for your local Ollama server. Installable as a PWA and optimized for mobile.

- Default server: `http://192.168.50.50:11434`
- Default model: `llama3.1`

#### Run locally

```bash
python3 -m http.server 8080 --directory /workspace/ollama-pwa
```

Then open `http://localhost:8080` on your device. Ensure your device can reach the Ollama server at `http://192.168.50.50:11434`.

#### iOS Add to Home Screen

- Open the site in Safari, tap Share → Add to Home Screen.
- For best icon quality on iOS, replace `icons/icon.svg` with PNG icons and add links in `index.html`:
  ```html
  <link rel="apple-touch-icon" href="/icons/icon-180.png">
  ```
  and update `manifest.webmanifest` icons accordingly.

#### Notes

- Streaming is enabled via `/api/chat`. Your Ollama must allow cross-origin requests (default in recent versions).
- Settings allow you to change server URL/model and choose whether to persist chat history locally.