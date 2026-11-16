# sgutils

Small, free utilities for Singapore, live at **[sgutils.com](https://sgutils.com)**.

Everything runs in the browser. There is no backend, no signup, and nothing you type is sent anywhere.

## Utilities

| Utility | URL | What it does |
| :-- | :-- | :-- |
| NRIC / FIN | [/](https://sgutils.com/) | Generates and validates NRIC and FIN numbers (prefixes S, T, F, G, M), including the checksum letter. |
| Date / Time | [/datetime/](https://sgutils.com/datetime/) | Converts between Unix timestamps, UTC, Singapore time and your local time. |
| HDB Cost | [/hdb/](https://sgutils.com/hdb/) | Estimates the upfront cash and CPF needed for an HDB resale flat, with HDB-loan and bank-loan options and monthly repayment. |
| UEN | [/uen/](https://sgutils.com/uen/) | Generates and validates Unique Entity Numbers in all three formats, including the check letter. |
| Phone | [/phone/](https://sgutils.com/phone/) | Generates random Singapore phone numbers (mobile, fixed line, VoIP, 1800) and validates a number's format, with or without +65. |
| Car Plate | [/car-plate/](https://sgutils.com/car-plate/) | Checks the checksum letter of a vehicle registration number, and generates test plates for cars, motorcycles, goods vehicles, buses and taxis. |

Generated identifiers are for testing and development only. They are not real identities or entities, although a generated number can coincide with a real one.

### How reliable the checksums are

- **NRIC / FIN:** the checksum for S, T, F and G is widely documented. The M-series (2022 onwards) is implemented the way public implementations agree on; ICA has not published it.
- **UEN:** ACRA does not publish the check-letter algorithm. The formulas used here are the community ones, and they matched every one of about 28,000 real UENs sampled from ACRA's open dataset on [data.gov.sg](https://data.gov.sg). A correct check letter does not mean an entity is registered.
- **Phone numbers:** format only, following IMDA's National Numbering Plan (Issue 2, February 2026). There is no checksum and no range reserved for fictional numbers, so a generated number can be in real use.
- **Car plates:** LTA does not publish the checksum formula. The one used here is the widely documented one, and it matched about 700 real plates (mostly public bus fleet lists). A correct checksum letter does not mean a plate is registered.
- **HDB calculator:** an estimate based on the rules at the time it was written. Rates, caps and stamp duty change, so check HDB, CPF Board, MAS and IRAS before relying on a figure.

## Development

Requires Node.js 22.12 or later.

| Command | Action |
| :-- | :-- |
| `npm install` | Install dependencies |
| `npm run dev` | Start the dev server at `localhost:4321` |
| `npm test` | Run the unit tests once |
| `npm run test:watch` | Run the unit tests in watch mode |
| `npm run build` | Build the static site into `dist/` |
| `npm run preview` | Serve the built site locally |
| `npm run generate:og` | Regenerate `public/og.png` from `scripts/og-image.svg` |

## Project structure

```text
src/
├── lib/          Pure TypeScript logic, one file per utility, no framework code
├── pages/        One Astro page per utility; the file name is the URL
├── components/   Layout.astro: shared head, nav, theme toggle, analytics
└── config/       site.ts (site metadata) and utilities.ts (nav entries)
tests/lib/        Vitest unit tests, one file per lib module
scripts/          Open Graph image generator
public/           Static files: robots.txt, favicon, og.png
```

### Adding a utility

1. Put the logic in `src/lib/<name>.ts` and its tests in `tests/lib/<name>.test.ts`.
2. Add the page at `src/pages/<name>.astro`, wrapped in `Layout`.
3. Add an entry to `src/config/utilities.ts` so it appears in the nav.

The sitemap picks up new pages automatically.

## Deployment

The site is built with [Astro](https://astro.build) as static files and hosted on Cloudflare Pages. Every push to `main` builds and deploys automatically.
