function checkForAutoLoad() {
  const assetsLoaded = localStorage.getItem('webdash_assets_loaded') === 'true';
  const lastLoadTime = parseInt(localStorage.getItem('webdash_last_load_time') || '0');
  const now = Date.now();
  const hoursSinceLoad = (now - lastLoadTime) / (1000 * 60 * 60);
  if (assetsLoaded && hoursSinceLoad < 24 && window.gameCache.isCacheValid()) {
    const stats = window.gameCache.getCacheStats();
    if (stats.validEntries > 50) {
      console.log('auto loading from cache');
      return true;
    }
  }
  return false;
}
if (window.gameCache) {
  window.gameCache.init();
  const canAutoLoad = checkForAutoLoad();
  if (canAutoLoad) {
    const autoLoadIndicator = document.createElement('div');
    autoLoadIndicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #00ff00;
      color: #000;
      padding: 5px 10px;
      border-radius: 5px;
      font-family: Arial;
      font-size: 12px;
      z-index: 9999;
    `;
    autoLoadIndicator.textContent = 'turbo loading';
    document.body.appendChild(autoLoadIndicator);
    setTimeout(() => {
      if (autoLoadIndicator.parentNode) {
        autoLoadIndicator.parentNode.removeChild(autoLoadIndicator);
      }
    }, 3000);
  }
}
const phaserConfig = {
  type: Phaser.AUTO,
  width: (typeof screenWidth !== "undefined" ? screenWidth : 1138),
  height: (typeof screenHeight !== "undefined" ? screenHeight : 640),
  resolution: 1,
  fps: {
    min: 30,
    target: 60,
    smoothStep: true,
    forceSetTimeOut: false
  },
  backgroundColor: "#000000",
  parent: typeof document !== "undefined" ? (document.body || document.documentElement) : undefined,
  input: {
    windowEvents: false
  },
  render: {
    powerPreference: "high-performance",
    batchSize: 4096,
    roundPixels: true,
    antialias: false,
    desynchronized: true
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [BootScene, GameScene]
};

function launchGame() {
  if (window.__wdGameInstance) return;
  const config = {
    ...phaserConfig,
    parent: document.body || document.documentElement
  };
  window.__wdGameInstance = new Phaser.Game(config);
  if (typeof window !== "undefined" && window.GraphicsManager) {
    setTimeout(() => {
      window.GraphicsManager.applyToGame();
      window.GraphicsManager.applyFilteringToCanvas();
    }, 100);
  }
}

if (typeof document !== "undefined" && document.body) {
  launchGame();
} else if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", launchGame);
  window.addEventListener("load", launchGame);
}

window.clearGameCache = () => {
  if (window.gameCache) {
    window.gameCache.clearCache();
    localStorage.removeItem('webdash_assets_loaded');
    localStorage.removeItem('webdash_last_load_time');
    console.log('Game cache cleared');
    location.reload();
  }
};

window.getCacheInfo = () => {
  if (window.gameCache) {
    return window.gameCache.getCacheStats();
  }
  return null;
};
