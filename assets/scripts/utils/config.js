// editable config stuff 

if (window.mainColor == null) {
  window.mainColor = parseInt(localStorage.getItem("iconMainColor") || "04FF00", 16);
}
if (window.secondaryColor == null) {
  window.secondaryColor = parseInt(localStorage.getItem("iconSecondaryColor") || "00FBFF", 16);
}
window.currentPlayer = localStorage.getItem("iconCurrentPlayer") || "player_01";
window.currentShip   = localStorage.getItem("iconCurrentShip")   || "ship_01";
window.currentBall   = localStorage.getItem("iconCurrentBall")   || "player_ball_01";
window.currentWave   = localStorage.getItem("iconCurrentWave")   || "dart_01";
window.currentSpider = localStorage.getItem("iconCurrentSpider") || "spider_01";
window.currentBird   = localStorage.getItem("iconCurrentBird")   || "bird_01";
const storedUseDirectInternet = localStorage.getItem("gd_useDirectInternet");
window.useDirectInternet = storedUseDirectInternet === "true";

const getLocalGdProxy = () => {
  if (typeof window !== "undefined" && window.location && window.location.origin && !window.location.origin.startsWith("file:")) {
    return `${window.location.origin}/api/gd`;
  }
  return "/api/gd";
};

const DEFAULT_GD_PROXY = getLocalGdProxy();
window._gdProxyUrl = DEFAULT_GD_PROXY;

window.getGdApiBase = function () {
  return (window._gdProxyUrl || DEFAULT_GD_PROXY).replace(/\/$/, "");
};

window.getGdApiUrl = function (path) {
  const base = window.getGdApiBase();
  if (!base) return null;
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
};

window.fetchGdApi = async function (path, options = {}) {
  const localBase = getLocalGdProxy();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${localBase}${cleanPath}`;
  return fetch(url, options);
};

window.getGdAudioUrl = function (songUrl) {
  if (!songUrl) return null;
  const localProxy = (typeof window !== "undefined" && window.location && window.location.origin && !window.location.origin.startsWith("file:"))
    ? `${window.location.origin}/api/gd/audio-proxy?url=${encodeURIComponent(songUrl)}`
    : `/api/gd/audio-proxy?url=${encodeURIComponent(songUrl)}`;
  return localProxy;
};

window.getGdSongAudioUrl = function (songId, songUrl) {
  if (!songId && !songUrl) return null;
  const origin = (typeof window !== "undefined" && window.location && window.location.origin && !window.location.origin.startsWith("file:"))
    ? window.location.origin
    : "";
  const params = new URLSearchParams();
  if (songId) params.append("id", songId);
  if (songUrl) params.append("url", songUrl);
  return `${origin}/api/gd/song-audio?${params.toString()}`;
};

window.fetchGdSongAudio = async function (songId, songUrl, options = {}) {
  const primaryUrl = window.getGdSongAudioUrl(songId, songUrl);
  if (!primaryUrl) throw new Error("No audio endpoint available");
  return fetch(primaryUrl, options);
};

window.getGdLevelInfoUrl = function (levelId) {
  if (!levelId) return null;
  const origin = (typeof window !== "undefined" && window.location && window.location.origin && !window.location.origin.startsWith("file:"))
    ? window.location.origin
    : "";
  if (origin) {
    return `${origin}/api/gd/level-info/${encodeURIComponent(levelId)}`;
  }
  return `https://gdbrowser.com/api/level/${encodeURIComponent(levelId)}`;
};

window.fetchGdLevelInfo = async function (levelId) {
  const urls = [
    window.getGdLevelInfoUrl(levelId),
    `https://gdbrowser.com/api/level/${encodeURIComponent(levelId)}`
  ].filter(Boolean);

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (_e) {}
  }
  return null;
};

window.fetchGdAudio = async function (songUrl, options = {}) {
  if (!songUrl) throw new Error("No song URL provided");
  const urls = [];
  const proxied = window.getGdAudioUrl(songUrl);
  if (proxied && !urls.includes(proxied)) urls.push(proxied);
  if (!urls.includes(songUrl)) urls.push(songUrl);
  let lastError = null;
  for (const url of urls) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No audio endpoint available");
};
window.currentlevel = [
	"stereo_madness", // internal level name
	"Stereo Madness", // proper level name
	"level_1",        // level id in assets/levels
	["RobTop", "Forever Bound"]   // person who made the song
];
window.orbClickScale = 2.0;
window.orbClickShrinkTime = 250;
window.orbParticleSize = 3.5;

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('id')) {
  window.levelID = urlParams.get('id');
}

// -------------------------------

function hexToHexadecimal(str) {
  return parseInt(str, 16);
}

function hexadecimalToHex(num) {
  return num.toString(16).padStart(6, '0');
}

let screenWidth = 1138;
const screenHeight = 640;
const a = 60;
const o = 180;
let centerX = screenWidth / 2 - 150;
function l(screenWidth) {
  this.screenWidth = screenWidth;
  centerX = screenWidth / 2 - 150;
}
const u = 1 / 240;
const SpeedPortal = {
  HALF: 9.30222544655,
  ONE_TIMES: 11.540004,
  TWO_TIMES: 14.3488938625,
  THREE_TIMES: 17.3333393414,
  FOUR_TIMES: 21.3333407279
}
let playerSpeed = SpeedPortal.ONE_TIMES;
const d = 0.9;
const p = 1.916398;
const f = 600;
const g = a;
const jumpPadType = "jump_pad";
const jumpRingType = "jump_ring";
const T = 460;
function b(y) {
  return T - y;
}
let S = Phaser.BlendModes.ADD;
let E = Phaser.BlendModes.NORMAL;

const fs = 1000;
const gs = 1001;

const atlasList = [
  "GJ_WebSheet",
  "GJ_GameSheet",
  "GJ_GameSheet02",
  "GJ_GameSheet03",
  "GJ_GameSheet04",
  "GJ_GameSheetEditor",
  "GJ_GameSheetGlow",
  "GJ_GameSheetIcons",
  "GJ_LaunchSheet",
  "player_ball_00",
  "player_dart_00",
  "GJ_ParticleSheet-uhd",
  "GJ_ParticleSheet",
  "PixelSheet_01-hd",
  "FireSheet_01-hd",
  "Wavesheet",
];
const _atlasFrameCache = new Map();
function getAtlasFrame(scene, frameName) {
  if (!frameName || !scene || !scene.textures) return null;
  if (_atlasFrameCache.has(frameName)) {
    return _atlasFrameCache.get(frameName);
  }
  if (frameName.startsWith("player_")) {
    const playerAtlasPriority = ["GJ_GameSheet03", "GJ_GameSheet", "GJ_GameSheet02", "GJ_GameSheet04", "GJ_GameSheetEditor", "GJ_GameSheetGlow", "GJ_GameSheetIcons", "GJ_WebSheet", "GJ_LaunchSheet", "player_ball_00", "player_dart_00"];
    for (let atlasName of playerAtlasPriority) {
      if (scene.textures.exists(atlasName)) {
        if (scene.textures.get(atlasName).has(frameName)) {
          const res = { atlas: atlasName, frame: frameName };
          _atlasFrameCache.set(frameName, res);
          return res;
        }
      }
    }
  }
  for (let atlasName of atlasList) {
    if (scene.textures.exists(atlasName)) {
      if (scene.textures.get(atlasName).has(frameName)) {
        const res = { atlas: atlasName, frame: frameName };
        _atlasFrameCache.set(frameName, res);
        return res;
      }
    }
  }
  _atlasFrameCache.set(frameName, null);
  return null;
}
function addImageToScene(scene, x, y, textureName) {
  let textureInfo = getAtlasFrame(scene, textureName);
  if (textureInfo) {
    return scene.add.image(x, y, textureInfo.atlas, textureInfo.frame);
  } else if (scene.textures.exists(textureName)) {
    return scene.add.image(x, y, textureName);
  } else {
    return null;
  }
}
