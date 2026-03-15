# Hackathon Progress

## 2026-03-15 13:56 SGT

### What changed
- Hardened spoken preference capture in `src/components/LiveStyleStudio.tsx` so dictated phrases append to the live brief instead of overwriting typed notes.
- Added a dedicated spoken-capture status panel that clearly shows mic readiness, voice-reply readiness, and the current live transcript draft while listening.
- Locked manual textarea edits during active dictation and stopped listening on submit, which prevents the live demo from mutating the brief mid-request while the style agent is already responding.

### Research notes
- This is a higher-leverage late-stage improvement than adding another visual control because the challenge scoring rewards a believable live multimodal loop, and transcript instability is a more obvious demo failure than a missing extra feature.
- Stable composition of typed notes plus dictated phrases makes the agent feel more grounded: the prompt sent to `/api/style-agent` now reflects the actual brief the presenter sees, instead of a moving browser transcript.
- Explicit capability pills for microphone and voice playback also improve operator confidence in front of judges because the browser support boundary is visible before something fails.

### Validation
- `npm run lint` passed.
- `./node_modules/.bin/tsc --noEmit` initially failed because `tsconfig.json` includes `.next/types/**/*.ts` and the local generated route types were incomplete; after the production build regenerated those files, `./node_modules/.bin/tsc --noEmit` passed.
- `npm run build` passed with Next.js production output for `/`, `/api/analyze-selfie`, `/api/health`, `/api/salons`, `/api/scrape-salons`, `/api/style-agent`, and `/icon.svg`.
- Focused browser verification was not run in this pass, so the new dictation panel and submit timing still need a manual Chrome-family check.

### Risks
- Speech recognition still depends on browser-native Web Speech support, so the strongest spoken demo path remains Chrome-family rather than fully portable.
- The current improvement stabilizes capture and request timing, but it does not upgrade the architecture to a true Gemini Live streaming session yet.
- Overlay realism and Cloud Run proof artifacts are still higher remaining submission risks than the voice UI itself.

### Next best steps
- Highest impact: run a real browser pass focused on webcam plus voice, confirm the new spoken-brief flow behaves cleanly in Chrome, and capture one short demo recording or screenshot sequence.
- After that, perform the actual Cloud Run deployment and capture `/api/health` plus live-app proof screenshots for submission materials.
- If there is still time, strengthen challenge alignment further by researching or implementing the safest possible Gemini Live session path beyond browser speech APIs.

## 2026-03-15 13:06 SGT

### What changed
- Added an `Auto align` action in the live stylist studio so the operator can clear manual fit tweaks and immediately re-run face-lock anchoring from the current webcam frame or uploaded selfie.
- Added a stronger face-lock quality panel with lock score, recovery guidance, and mode-specific instructions for webcam, selfie, and mannequin previews.
- Kept the change scoped to `src/components/LiveStyleStudio.tsx` so the recovery path improves the live try-on without destabilizing the rest of the demo flow.

### Research notes
- The highest-leverage late-stage improvements are the ones that reduce presenter recovery time during a live judging session. One-tap re-anchoring is more valuable than additional manual controls because it shortens the path back to a believable preview.
- The project already had browser face-lock heuristics; surfacing their strength and recovery path makes the experience feel intentional and robust instead of opaque.
- This run improved the "polished user experience" and "robust agent architecture" story more than raw geometry accuracy. Landmark anchoring is still the larger technical upside if time remains.

### Validation
- `npm run lint` passed.
- `./node_modules/.bin/tsc --noEmit` passed.
- `npm run build` passed.
- Attempted focused browser verification, but local Next.js serving was unreliable in this environment due `EMFILE` watcher errors under `next dev`, and `next start` could not serve from `.next` because `BUILD_ID` was missing even after the successful build output. Static validation is clean, but a manual browser pass is still required on a cleaner local session or deployed URL.

### Risks
- Overlay placement is still based on bounding-box heuristics, so recovery is better but raw hairstyle realism is not yet landmark-anchored.
- This exact UI path still needs a real browser pass because the local environment could not serve a stable page after the build.
- Submission proof artifacts are still missing for the deployed Cloud Run path and the final live-demo flow.

### Next best steps
- Highest impact: run a clean manual webcam pass and tune the box-to-crown calibration constants against recorded frames so the automatic baseline lands closer before any manual intervention.
- After that, perform an actual Cloud Run deploy and capture one `/api/health` screenshot plus one live-app screenshot for submission materials.
- If time remains, research or implement the safest possible Gemini Live session upgrade so the architecture story is stronger than browser speech alone.

## 2026-03-15 13:02 SGT

### What changed
- Added a precision-fit control panel in the live stylist studio so the operator can manually tune crown lift, length drop, lateral offset, scale, width, angle, and blend during the demo.
- Moved overlay tuning into a typed `OverlayAdjustment` layer that applies on top of the existing face-shape and detected-face calibration instead of replacing it.
- Added reset behavior and fit telemetry so the demo can recover quickly if webcam framing, posture, or lighting nudges the overlay off target.

### Research notes
- This is a good late-stage hackathon improvement because it improves the most visible failure mode in a live demo without introducing a new model dependency or destabilizing the agent flow.
- Judges are more likely to reward a believable, controllable live try-on than an over-ambitious landmark stack that is not battle-tested before the March 17, 2026 deadline.
- Manual fit controls pair well with the current detected-face anchoring: the auto system handles the baseline, and the operator gets a fast recovery path for real-world camera variance.

### Validation
- `npm run lint` passed.
- `./node_modules/.bin/tsc --noEmit` passed.
- `npm run build` passed.
- Focused browser verification was attempted, but Playwright could not launch because Chrome was already attached to an existing session in this environment, and `next dev` also hit `EMFILE` watcher limits. Static code inspection confirms the new controls wire into the rendered studio and feed the overlay adjustment layer.

### Risks
- This improves demo resilience more than true geometry accuracy; landmark-level realism is still limited by the current browser-side face-box anchoring.
- The new controls are operator-facing, so the demo script should include one quick line explaining that the fit can be refined live for camera framing.
- A real browser pass is still missing in this environment and should be done manually before submission.

### Next best steps
- Highest impact: run a manual webcam pass and tune the detected-face crown calibration so the automatic baseline lands closer before any manual adjustment.
- After that, capture submission assets: one live studio screenshot showing the precision-fit panel and one Cloud Run `/api/health` proof screenshot.
- If time remains, strengthen the README and architecture materials with a short section that frames auto-fit plus precision tuning as a deliberate live-demo reliability feature.

## 2026-03-15 13:02 SGT

### What changed
- Mirrored the live webcam preview so the stylist studio behaves like a salon mirror instead of an outward-facing camera feed.
- Mirrored the hairstyle overlay in webcam mode and flipped the face-lock projection so crown guides and try-on placement stay aligned with the mirrored preview.
- Kept selfie and mannequin behavior unchanged so the improvement stays isolated to the highest-friction live-demo path.

### Research notes
- Mirror behavior is a meaningful UX improvement for beauty and styling demos because users instinctively evaluate their look against a mirror reference, not an unflipped camera image.
- The previous live studio geometry could feel directionally wrong during webcam use even when the raw overlay math was reasonable, because user movement and hair placement read backwards.
- This is a good late-stage hackathon fix: low implementation risk, immediately visible in demo narration, and directly supportive of the "polished live multimodal experience" judging axis.

### Validation
- `npm run lint` passed.
- `./node_modules/.bin/tsc --noEmit` passed.
- `npm run build` passed.
- Attempted focused browser verification, but Playwright browser launch failed because Chrome was already attached to an existing session in this environment. Static code inspection confirms the mirrored transform is applied only to webcam mode.

### Risks
- The overlay is still box-anchored rather than landmark-anchored, so mirror correctness improves usability more than raw hairstyle realism.
- Browser-based face detection remains dependent on local platform support and may still drift under aggressive motion or occlusion.
- A true recorded browser pass is still missing, so the mirrored webcam flow should be manually checked before the March 17 demo.

### Next best steps
- Highest impact: do a manual webcam pass and tighten box-to-crown calibration so the mirrored overlay also lands more convincingly on real faces.
- After that, capture one deployed Cloud Run `/api/health` screenshot and one live app screenshot for submission materials.
- If time remains, improve salon matching quality so the final handoff feels as intentional as the live try-on.

## 2026-03-15 06:47 SGT

### What changed
- Added `cloudbuild.yaml` so the app can be built, pushed, and deployed to Cloud Run in one pipeline.
- Added `deploy/cloudrun-service.yaml` with Gen2 Cloud Run settings, warm-instance defaults, and `/api/health` startup and liveness probes.
- Expanded `/api/health` to expose service name, revision, deployment target, config signals, and challenge-readiness flags that are useful in a live judge demo.
- Added `docs/google-cloud-demo-readiness.md` with a judge-facing architecture diagram, deploy flow, and proof points.
- Updated `README.md` so the Cloud Run and submission story is concrete instead of implied.

### Research notes
- The product story is already credible on the UX side; the bigger remaining judging risk is proving this is a deployable Gemini app on Google Cloud rather than a local front-end prototype.
- For a live demo, showing `/api/health` on a Cloud Run URL is a strong proof artifact because it ties runtime, revision, and challenge criteria to the deployed service in one screen.
- `asia-southeast1`, `minScale: 1`, and Secret Manager-backed Gemini credentials are the right defaults for a Singapore-based judging setup because they reduce cold-start and operational uncertainty without adding architecture sprawl.

### Validation
- `npm run lint` passed.
- `./node_modules/.bin/tsc --noEmit` passed.
- `npm run build` passed with Next.js production output including `/api/health`.

### Risks
- The app still does not use a true Gemini Live API session; the experience is multimodal but browser speech plus request/response style rather than a native live stream.
- Webcam hairstyle placement is still heuristic rather than landmark-driven, so visual try-on credibility can still improve.
- Cloud deployment artifacts are ready, but there is not yet a checked-in screenshot or URL proving a successful live Cloud Run deployment.

### Next best steps
- Highest impact: add a true live-session path or, if that is too risky this late, ship a landmark-guided webcam calibration pass so the try-on looks more convincingly anchored during the demo.
- After that, perform an actual Cloud Run deploy and capture one screenshot of `/api/health` plus the live app URL for submission materials.
- If time remains, tighten the salon handoff quality so the end of the demo feels as intentional as the agent interaction.

## 2026-03-15 02:10 SGT

### What changed
- Polished the live stylist experience into a more editorial studio instead of a dashboard.
- Added webcam preview, speech capture, live mashup generation, and stylist session memory.
- Added spoken agent replies in the browser so the demo now covers see, hear, and speak more clearly.
- Preserved recent user and agent turns so follow-up preferences build on earlier direction.

### Research notes
- The Gemini Live Agent Challenge is judged most heavily on immersive multimodal UX, then technical implementation and demo quality.
- The current app is strongest as a Live Agents submission if we keep pushing real-time interaction, believable overlay try-on, and clear proof of backend/cloud architecture.

### Validation
- Pending this log entry: run lint, type checks, build, and a browser pass after the newest live-agent session upgrade.

### Risks
- The current experience feels live, but we still need stronger proof for the mandatory Google Cloud and Gemini Live API requirements.
- The overlay is stylized rather than face-landmark-anchored, so visual accuracy can still improve.

### Next best steps
- Add stronger overlay calibration or face-guided positioning so the hairstyle sits more convincingly on different portraits.
- Replace or augment browser voice features with a true Gemini Live API path and document the Google Cloud architecture clearly.
- Tighten the README, demo script, and architecture diagram so submission assets are as strong as the product itself.
