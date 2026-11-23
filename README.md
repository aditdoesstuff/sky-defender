# Sky Defender

A phone-based AR browser game. Your rear camera is the background, hostile drones close in from every direction, and you aim by turning your phone. Tap to fire. Survive escalating Sectors and chase a high score.

Built with Vite, TypeScript and Three.js. No WebXR, no backend, no API keys, no analytics.

## How to play

- Tap **Tap to deploy** and allow the camera and motion access.
- Turn your phone to put the center reticle on a drone. The reticle tightens when it is over a target.
- Tap anywhere to fire. Scouts take 1 hit, standard drones 2, heavies 4.
- Drones that reach you reduce **Base Integrity**. At 0% the mission ends. Under 30% a low alarm sounds.
- Score is shown as **Neutralised**. Kills in a row raise a streak multiplier, and clearing a Sector without damage gives a bonus.
- Use the compass strip and the radar to find where contacts are coming from.
- Your high score is saved in the browser.

## Run locally

```bash
npm install
npm run dev      # dev server, also reachable on your LAN
npm run lint
npm run test
npm run build
npm run preview
```

On a desktop with no motion sensor the game falls back to mouse drag to look and click to fire. If camera permission is denied you get a dark backdrop.

## Test on a phone

Camera and motion sensors need HTTPS, so `http://<lan-ip>:5173` will not work for the camera. Use the deployed link, or tunnel the dev server through an HTTPS tunnel of your choice.

## Browser support

- **iOS Safari:** motion access must be requested from a tap. The Tap to deploy button does this. If you deny it, drag the screen to look. To reset a denial, quit Safari and reopen the page.
- **Android Chrome:** uses absolute orientation when available.
- Haptics use `navigator.vibrate`, which iOS Safari does not support.
- Audio is synthesised with the Web Audio API and starts after your first tap.

## Deployment

Hosted on Vercel. Vite is auto-detected, so no `vercel.json` is needed.

```bash
npx vercel --prod
```

## Layout

`src/logic.ts` pure maths (spawn, hit test, wave scaling), `src/game.ts` state and rules, `src/scene.ts` Three.js scene and pools, `src/sensors.ts` camera and orientation, `src/hud.ts` HUD and cards, `src/audio.ts` synth sounds.
