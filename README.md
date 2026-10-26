# The Back End of Open Silicon: Custody, Provenance, Trust

A funding proposal for the last mile of open silicon: sort, packaging, test and provisioning for open-source chips, starting with MEME and wafer.space, built in Singapore.

Andrew Wingate · Evezor Inc. · [evezor.com](https://evezor.com)

## View the slides

**Live: [anfroholic.github.io/silicon_grant](https://anfroholic.github.io/silicon_grant/)**

Or open `index.html` in a browser. There's no build step. The deck is a fixed 1920×1080 stage that scales to fit the window.

| Key | Action |
| --- | --- |
| → / Space, ← | next / previous |
| Home / End | first / last |
| O | overview grid |
| F | fullscreen |
| N | speaker notes |
| P | presenter window (notes on a second screen) |
| ? | help |

- Deep link to a slide: `index.html#12`
- `index.html?static` turns animations off (for screenshots or printing to PDF).

## Layout

- `index.html`: the slides. Each slide's speaker notes sit in an `<aside class="notes">`.
- `assets/css/theme.css`, `assets/js/deck.js` (deck engine), `assets/js/demos.js` (live figures), `assets/img/`.
- `tools/`: scripts that generate two of the figures.
  - `gen_puf_renders.py` renders the PUF figures straight from the MEME signoff GDS:
    `uv run --no-project --with klayout --with pillow python tools/gen_puf_renders.py <chip_top.gds.gz> assets/img`
  - `gen_sg_pearl.py` draws the Singapore halftone island:
    `python tools/gen_sg_pearl.py assets/img/sg-pearl.svg`

## Credits

Singapore coastline (`tools/sg-coast.json`, used for `assets/img/sg-pearl.svg`) © OpenStreetMap contributors, available under the Open Database License (ODbL).
