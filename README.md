# breathe

A calm, beautiful guide for paced breathing exercises — built for a therapist to
use with clients. Live at [breathe.alucard.dev](https://breathe.alucard.dev).

Box breathing, 4-7-8, coherent breathing, triangle, extended exhale, the
physiological sigh, or a fully custom pace — visualized as a softly glowing orb
of ~15,000 particles that expands as you inhale and settles as you exhale.

Same pattern as [nova](https://nova.alucard.dev) and [finale](https://250.alucard.dev):
the particle physics is Rust compiled to WebAssembly (`wasm/`), rendering and
orchestration are TypeScript (`src/`), zero frameworks, state crossing the
JS/WASM boundary as typed-array views over linear memory.

Privacy by construction: no backend, no analytics, no external requests.
Settings live in `localStorage` only.

## Develop

```sh
npm install     # requires rust + wasm32 target + wasm-pack + node 22
npm run dev     # wasm build + vite dev server
npm run build   # production build → dist/
```

## Deploy

```sh
docker build -t breathe .   # multi-arch-aware nginx container
```

Pushed to Docker Hub by CI on `main`; deployed via Flux from
`homelab-k8s/apps/breathe/`.

## Accessibility

- `prefers-reduced-motion` swaps the particle orb for a single smoothly-scaling
  circle — no WASM even instantiated.
- Keyboard: Space pauses/resumes, Escape ends the session.
- Large-text mode, `aria-live` phase announcements, screen wake-lock during
  sessions.
