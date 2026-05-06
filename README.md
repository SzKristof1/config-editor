# Config Editor (static)

A tiny static website that edits an `.ini` file locally in the browser.

- Only updates:
  - `steam_id=...`
  - `player_name=...`
- Leaves the rest unchanged.
- Works fully client-side (no server).

## Steam profile link support

This static version can extract SteamID64 from:

- `https://steamcommunity.com/profiles/<steamid64>/`

Vanity links like `https://steamcommunity.com/id/<name>/` require calling Steam's `ResolveVanityURL` Web API, which needs an API key and is commonly blocked by CORS in a browser-only app.

## Run locally

Just open `index.html` in your browser.

## Deploy with GitHub Pages

1. Repo Settings → Pages
2. Source: `main` branch, `/ (root)`
3. Open the Pages URL
