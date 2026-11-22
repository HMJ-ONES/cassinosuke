# Cassinosuke Games

Free browser games hub — live at https://cassinosuke.pages.dev

- **Five-Card Poker** — https://five-card-poker.pages.dev
- **Black Nyack** — https://black-nyack.pages.dev
- **RNG Chess** — https://rng-chess.pages.dev
- **Wellington Online** — https://wellington-online.pages.dev
- **CULT-ULHU** (under development, download coming soon) — https://github.com/HMJ-ONES/CULTHULU

## Deploy (Cloudflare Pages)

Dashboard → Workers & Pages → Create → Pages → Connect to Git → pick `cassinosuke` → Framework preset: **None**, build command: `python3 decode_images.py`, output directory: `/` → Deploy.

Static site: `index.html` + `images/` (webp cover art). The build command only decodes the images — see below.

## Images — why .b64?

The GitHub push route for this repo only carries UTF-8 text, so the binary
cover art is stored as base64 text (`images/<name>.webp.b64`). The Pages
build command `python3 decode_images.py` decodes them back to `.webp` at
deploy time, so the live site serves real images at the paths `index.html`
references. To replace an image: drop in the new `.webp`, re-encode it with
`base64 -w0 images/<name>.webp > images/<name>.webp.b64`, and push the
`.b64` file (the `.webp` itself is not pushed).
