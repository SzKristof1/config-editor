const iniFileInput = document.getElementById("iniFile");
const steamLinkInput = document.getElementById("steamLink");
const submitBtn = document.getElementById("submit");
const downloadLink = document.getElementById("downloadLink");

/**
 * Supports:
 *  - https://steamcommunity.com/profiles/<steamid64>/
 *  - https://steamcommunity.com/id/<vanity>/  (cannot resolve without a server/API key)
 *
 * For a pure static site, we can ONLY reliably extract steamid64 from /profiles/<id>.
 * Vanity URLs require Steam Web API (ResolveVanityURL) which needs an API key and CORS may block browser calls.
 */
function extractSteamId64(steamUrl) {
  const url = steamUrl.trim();

  const profilesMatch = url.match(/steamcommunity\.com\/profiles\/(\d{17})/i);
  if (profilesMatch) return profilesMatch[1];

  const vanityMatch = url.match(/steamcommunity\.com\/id\/([^\/?#]+)/i);
  if (vanityMatch) {
    // Static-only limitation
    throw new Error(
      "Vanity Steam links (/id/...) can’t be resolved in this static version without a backend or API proxy. Please use a /profiles/<steamid64>/ link."
    );
  }

  throw new Error("Invalid Steam profile link. Use steamcommunity.com/profiles/<steamid64>/");
}

function detectNewline(text) {
  if (text.includes("\r\n")) return "\r\n";
  return "\n";
}

function updateIniText(original, steamId, displayName) {
  const newline = detectNewline(original);
  const lines = original.split(/\r?\n/);

  const steamRe = /^\s*steam_id\s*=\s*.*$/i;
  const nameRe = /^\s*player_name\s*=\s*.*$/i;

  let foundSteam = false;
  let foundName = false;

  for (let i = 0; i < lines.length; i++) {
    if (steamRe.test(lines[i])) {
      lines[i] = `steam_id=${steamId}`;
      foundSteam = true;
    } else if (nameRe.test(lines[i])) {
      lines[i] = `player_name=${displayName}`;
      foundName = true;
    }
  }

  if (!foundSteam || !foundName) {
    // Try to insert under [game]
    const gameHeaderIdx = lines.findIndex(l => /^\s*\[\s*game\s*\]\s*$/i.test(l));
    const insert = [];
    if (!foundSteam) insert.push(`steam_id=${steamId}`);
    if (!foundName) insert.push(`player_name=${displayName}`);

    if (gameHeaderIdx !== -1) {
      lines.splice(gameHeaderIdx + 1, 0, ...insert);
    } else {
      lines.push(...insert);
    }
  }

  return lines.join(newline);
}

submitBtn.addEventListener("click", async () => {
  downloadLink.style.display = "none";
  downloadLink.removeAttribute("href");

  const file = iniFileInput.files?.[0];
  if (!file) {
    alert("Please select an .ini file first.");
    return;
  }

  if (!file.name.toLowerCase().endsWith(".ini")) {
    alert("Please select a .ini file.");
    return;
  }

  try {
    const steamId = extractSteamId64(steamLinkInput.value);
    const displayName = prompt("Enter display name (player_name):", "");
    if (!displayName) {
      alert("Display name is required.");
      return;
    }

    const text = await file.text();
    const updated = updateIniText(text, steamId, displayName);

    const blob = new Blob([updated], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    downloadLink.href = url;
    downloadLink.download = file.name;
    downloadLink.textContent = "Download Edited INI";
    downloadLink.style.display = "inline-block";
  } catch (e) {
    alert(e?.message || String(e));
  }
});
