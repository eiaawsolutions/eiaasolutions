# CoS avatar: handoff

Branch: `claude/eloquent-pasteur-zn8zou` (repo `eiaawsolutions/eiaasolutions`). Not merged to the default branch yet. No PR opened.

## 1. What CoS is, and what it is not

- **CoS = the face of the new product** `cos.eiaawsolutions.com` (the EIAAW Chief of Staff project). That product is a separate project and is **not built in this repo**.
- On **eiaawsolutions.com** the avatar is only the **face of the existing chat assistant**. The assistant is still named "EIAAW assistant" in all text. The chat flow, lead gate and API are unchanged.
- Character: soft glossy teal shield-head, cream face, big eyes, blush in brand gold, gold bouncing antenna, floating mitten hands, three orbiting satellites (Brief / Schedule / Decide).
- Brand tokens used: `#0A4D47` `#11766A` `#1FA896` `#22B8A5` `#7FE6D4`, cream `#FAF7F2`, gold `#E8B04A` (gold = "working on it").

## 2. File map

| File | Purpose |
|---|---|
| `cos-avatar.js` | Reusable avatar module. `CoSAvatar.mount(canvas, opts)`. Lazy-loads Three.js. |
| `vendor/three.r128.min.js` | Self-hosted Three.js r128 (MIT). No CDN dependency. |
| `brand/cos.png` | 320px transparent poster. Launcher image and no-WebGL fallback. |
| `eiaaw-connect.js` | Chat wiring: loads the avatar on first open, maps chat events to avatar states, voice toggle, one-time teaser. |
| `style.css` (end of file) | `.cos-launcher`, `.cos-teaser`, `.cos-face`, `.cos-voice`. |
| `index.html`, `products.html`, `privacy.html` | Launcher button (`.chat-toggle.cos-launcher`). `privacy.html` also loads `eiaaw-connect.js`. |
| `cos/avatar.html` | Standalone concept/demo page (full scene, 3 languages, demo briefing). Also published as a private Artifact. |
| `cos/avatar-preview.png` | Screenshot of the concept page. |

Not changed: `404.html` (uses absolute asset paths; no chat there).

## 3. Avatar API (`cos-avatar.js`)

```js
const cos = await CoSAvatar.mount(canvasEl, {
  frame: 'bust' | 'head',   // 'head' = tight crop for chat headers
  minimal: true | false,    // true hides hands, halo, satellites, dust (cheap)
  active: true              // false = start paused
});
cos.setState('idle' | 'listening' | 'thinking' | 'speaking');
cos.say(text, { sound: true, lang: 'en' | 'ms' | 'zh' }); // Promise; auto-detects lang if omitted
cos.stop();               // cancel speech, back to idle
cos.wave();               // full scene only
cos.setActive(false);     // pause rendering (closed panel / offscreen)
cos.hasVoice('ms');       // is a device voice available?
cos.destroy();
```

Chat mapping (`eiaaw-connect.js`): input focus = `listening`, message sent = `thinking`, API reply = `speaking` (and `say`), done/error/blur = `idle`.

Performance rules already in place: Three.js loads only on first chat open; rendering pauses when the panel closes or the tab is hidden; `prefers-reduced-motion` slows animation; WebGL failure leaves the static poster.

## 4. Voice: current state and the plan

**Today:** `say()` uses the browser's built-in Web Speech engine. Free, on-device, nothing sent anywhere. It is **off by default** (🔊 toggle in the chat header, remembered per session). Quality varies by device; Bahasa Melayu is the weakest (some devices fall back to an Indonesian voice).

**Requested:** CoS should use the **same voice as "Talk to our AI agent"**. Findings:

- "Talk to the agent" calls `POST https://sa.eiaawsolutions.com/api/voice/public-session` and opens the returned `callUrl` (https only) in a new tab. It is a **hosted call session**.
- The voice provider and voice ID are **not visible in this repo**. The privacy page only says "our voice AI provider". Nothing in this repo reveals which one.
- The browser therefore cannot reuse that voice by itself. It needs a **text-to-speech endpoint on the Sales Agent service** that uses the same provider and voice ID.

**Plan (needs the `sa` service repo, which this session could not access):**

1. In the sa service, find which provider and voice ID back `/api/voice/public-session`.
2. Add `POST /api/cos/tts` with body `{ text, lang }` that returns `audio/mpeg`, using that same voice and a multilingual model.
   - CORS allow-list: `https://eiaawsolutions.com`, `https://cos.eiaawsolutions.com`.
   - Limits: max ~400 characters per call, rate limit per IP, and require the chat lead gate to have passed (or a signed short-lived token) so it cannot be abused as free TTS.
   - Cache by hash of (text, lang, voiceId) to cut cost.
   - Never expose the provider API key to the browser.
3. In `cos-avatar.js`, add `opts.ttsUrl`. In `say()`: `fetch` the audio, play it with an `Audio` element, and drive the mouth from an `AnalyserNode` (real lip movement) instead of the sine-wave placeholder. Fall back to Web Speech if the call fails.
4. Update `privacy.html`: reply text is sent to the voice provider to generate audio (the voice provider is already listed, so this is mostly a wording check).
5. Keep it opt-in (toggle off by default). Autoplaying audio is blocked by browsers and unwelcome anyway.

Open question for the team: does the existing voice agent speak Bahasa Melayu and Mandarin well? If not, pick a multilingual voice and use it for both products.

## 5. Using CoS on cos.eiaawsolutions.com

- Copy `cos-avatar.js`, `vendor/three.r128.min.js` and `brand/cos.png` into the product's static assets (keep the `vendor/` folder next to the script, because the script resolves it relative to its own URL).
- Hero/full scene: `mount(canvas, { frame: 'bust' })`, which includes hands, halo and satellites. `cos/avatar.html` is a complete reference for layout, copy per state, and the EN/BM/中文 strings (`I18N` object).
- Drive states from the product's real agent events (listening while transcribing, thinking during tool calls, speaking during output). Satellites can later map to real sub-agents (Brief, Schedule, Decide).
- Product-level decisions not made yet: final name styling ("CoS" / "Chief of Staff"), tagline, product personality script, whether satellites are interactive.

## 6. Run and test locally

```bash
git fetch origin claude/eloquent-pasteur-zn8zou
git checkout claude/eloquent-pasteur-zn8zou
npm install && npm start        # serves on http://localhost:3000
```

- Concept page: `http://localhost:3000/cos/avatar.html`
- Homepage chat: click the CoS face bottom-right, pass the form (name, email, phone, tick consent), send a message. Needs the live `sa.eiaawsolutions.com` API (or mock `/api/forms/public/lead-intake` and `/api/chatbot`).
- Headless check used in this session: Playwright + Chromium with `--use-gl=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.

## 7. Gotchas

- `serve.json` caches `js/css/png` for a year (`immutable`). **Bump the `?v=` query** on `style.css`, `eiaaw-connect.js`, `cos-avatar.js`, `brand/cos.png` whenever they change. Current version string: `20261006b` (note: `cos-avatar.js` is requested with it from `eiaaw-connect.js`).
- `docs/*` is redirected to `/not-found` by `serve.json`, so this file is not public.
- `cos/avatar.html` **is** public at `/cos/avatar.html` (marked `noindex`). Remove it before launch if you do not want the concept page live, or move it to the product repo.
- Chat copy: the greeting and header say "EIAAW assistant", not "CoS". Keep it that way unless the brand decision changes.
- Three.js is pinned at r128 on purpose (known-good with this code). Upgrade deliberately; some APIs changed in later versions.
- Web Speech needs a user gesture and installed voices. No voice for a language = silent animation plus text.

## 8. Who does what

**Claude can do (ask in the next session):**
- Open the PR and watch CI/deploy.
- Wire `ttsUrl` and the analyser lip-sync in `cos-avatar.js` once the endpoint exists.
- Build the CoS section/landing for `cos.eiaawsolutions.com`.
- Export transparent pose PNGs (wave, thinking, speaking) and a GLB (the GLB route spends Higgsfield credits; approve first).

**You need to do:**
1. Merge the branch and let Railway deploy; test on real phone and laptop (Chrome, Safari/iOS).
2. Identify the voice provider and voice ID behind `/api/voice/public-session` and decide the TTS endpoint design (section 4). This needs access to the `sa` service.
3. Have native speakers review the Malay and Mandarin lines in `cos/avatar.html` (`I18N`).
4. Confirm the `cos.eiaawsolutions.com` product name styling and personality script.
5. Decide whether `/cos/avatar.html` stays public.
6. Trademark/brand clearance for the CoS character, if it will be a registered brand asset (legal advisor).

## 9. Suggested next prompt for the next session

> Read `docs/COS-HANDOFF.md`. Open a PR from `claude/eloquent-pasteur-zn8zou`. Then implement `opts.ttsUrl` in `cos-avatar.js` with analyser-driven lip-sync and Web Speech fallback, against a `POST /api/cos/tts` contract I will provide.
