const $ = (id) => document.getElementById(id);

const iniFileInput = $("iniFile");
const dropzone = $("dropzone");
const fileName = $("fileName");

const modeSteamLinkBtn = $("modeSteamLink");
const modeSteamIdBtn = $("modeSteamId");
const modeHint = $("modeHint");

const steamLinkGroup = $("steamLinkGroup");
const steamIdGroup = $("steamIdGroup");

const steamLinkInput = $("steamLink");
const steamIdInput = $("steamId");
const displayNameInput = $("displayName");

const statusEl = $("status");
const submitBtn = $("submit");

const outputCard = $("outputCard");
const showOutputCard = $("showOutputCard");
const hideOutputBtn = $("hideOutputBtn");
const showOutputBtn2 = $("showOutputBtn2");

const downloadWrap = $("downloadWrap");
const downloadLink = $("downloadLink");
const outPreview = $("outPreview");
const copyBtn = $("copyBtn");

let lastOutputBlobUrl = null;
let hasOutput = false;
let mode = "steamLink";

function setStatus(message, type = "info") {
  statusEl.textContent = message;
  statusEl.className = `status status--${type}`;
}

function detectNewline(text) {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

function extractSteamId64(steamUrl) {
  const url = (steamUrl || "").trim();

  const profilesMatch = url.match(/steamcommunity\.com\/profiles\/(\d{17})/i);
  if (profilesMatch) return profilesMatch[1];

  const vanityMatch = url.match(/steamcommunity\.com\/id\/([^\/?#]+)/i);
  if (vanityMatch) {
    throw new Error(
      "Vanity Steam links (/id/...) can’t be resolved in this static version. Please use a /profiles/<steamid64>/ link or switch to SteamID64 mode."
    );
  }

  if (/^\d{17}$/.test(url)) return url;

  throw new Error(
    "Invalid Steam profile link. Use steamcommunity.com/profiles/<steamid64>/ or switch to SteamID64 mode."
  );
}

function updateIniText(original, steamId, displayName) {
  const newline = detectNewline(original);
  const lines = original.split(/\r?\n/);

  const steamRe = /^\s*steam_id\s*=.*$/i;
  const nameRe = /^\s*player_name\s*=.*$/i;

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
    const gameHeaderIdx = lines.findIndex((l) => /^\s*\[\s*game\s*\]\s*$/i.test(l));
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

function setOutputVisible(visible) {
  if (!hasOutput) {
    outputCard.hidden = true;
    showOutputCard.hidden = true;
    return;
  }

  outputCard.hidden = !visible;
  showOutputCard.hidden = visible;
}

function setMode(newMode) {
  mode = newMode;

  const link = mode === "steamLink";
  steamLinkGroup.hidden = !link;
  steamIdGroup.hidden = link;

  modeSteamLinkBtn.classList.toggle("is-active", link);
  modeSteamIdBtn.classList.toggle("is-active", !link);

  modeSteamLinkBtn.setAttribute("aria-selected", String(link));
  modeSteamIdBtn.setAttribute("aria-selected", String(!link));

  modeHint.textContent = link
    ? "Paste a Steam profile link. Best supported: steamcommunity.com/profiles/<steamid64>/"
    : "Enter your 17-digit SteamID64 manually.";

  setStatus(link ? "Mode: Steam link" : "Mode: SteamID64", "info");
}

function setSelectedFile(file) {
  if (!file) {
    iniFileInput.value = "";
    fileName.textContent = "No file selected";
    return;
  }

  if (!file.name.toLowerCase().endsWith(".ini")) {
    setStatus("Please select a .ini file.", "error");
    return;
  }

  // Put file into the hidden input so existing code can read it
  const dt = new DataTransfer();
  dt.items.add(file);
  iniFileInput.files = dt.files;

  fileName.textContent = file.name;
  setStatus("INI file selected.", "success");
}

// Dropzone click -> open file dialog
function openFileDialog() {
  iniFileInput.click();
}

dropzone.addEventListener("click", openFileDialog);
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    openFileDialog();
  }
});

// File chosen via dialog
iniFileInput.addEventListener("change", () => {
  const file = iniFileInput.files?.[0];
  setSelectedFile(file || null);
});

// Drag & drop behavior
dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("is-dragover");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("is-dragover");
});

dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("is-dragover");

  const file = e.dataTransfer?.files?.[0];
  setSelectedFile(file || null);
});

modeSteamLinkBtn.addEventListener("click", () => setMode("steamLink"));
modeSteamIdBtn.addEventListener("click", () => setMode("steamId"));

hideOutputBtn.addEventListener("click", () => setOutputVisible(false));
showOutputBtn2.addEventListener("click", () => setOutputVisible(true));

copyBtn.addEventListener("click", async () => {
  const text = outPreview.value;
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    setStatus("Copied edited INI to clipboard.", "success");
  } catch {
    setStatus("Could not copy to clipboard (browser blocked it).", "warn");
  }
});

submitBtn.addEventListener("click", async () => {
  // Hide output until we successfully generate new output
  downloadWrap.hidden = true;
  outPreview.value = "";
  hasOutput = false;
  setOutputVisible(false);

  const file = iniFileInput.files?.[0];
  if (!file) {
    setStatus("Select an .ini file first.", "error");
    return;
  }
  if (!file.name.toLowerCase().endsWith(".ini")) {
    setStatus("Please select a .ini file.", "error");
    return;
  }

  const displayName = (displayNameInput.value || "").trim();
  if (!displayName) {
    setStatus("Display name is required.", "error");
    return;
  }

  let steamId;
  try {
    if (mode === "steamLink") {
      steamId = extractSteamId64(steamLinkInput.value);
    } else {
      steamId = (steamIdInput.value || "").trim();
      if (!/^\d{17}$/.test(steamId)) {
        throw new Error("SteamID64 must be exactly 17 digits.");
      }
    }
  } catch (e) {
    setStatus(e?.message || String(e), "error");
    return;
  }

  setStatus("Reading file…", "info");

  try {
    const text = await file.text();
    const updated = updateIniText(text, steamId, displayName);

    outPreview.value = updated;

    // Revoke previous Blob URL if any
    if (lastOutputBlobUrl) {
      URL.revokeObjectURL(lastOutputBlobUrl);
      lastOutputBlobUrl = null;
    }

    const blob = new Blob([updated], { type: "text/plain" });
    lastOutputBlobUrl = URL.createObjectURL(blob);

    downloadLink.href = lastOutputBlobUrl;
    downloadLink.download = file.name;

    downloadWrap.hidden = false;

    hasOutput = true;
    setOutputVisible(true);

    setStatus(`Done. steam_id set to ${steamId}.`, "success");
  } catch (e) {
    setStatus(e?.message || String(e), "error");
  }
});

// init
setMode("steamLink");
setOutputVisible(false);
setSelectedFile(null);
