/**
 * Web Dashers Graphics & Resolution Manager
 * Handles Low (50%), Medium (75%), and High (100%) rendering resolution downscaling
 * along with performance culling, LDM, and texture filtering options.
 */
(function () {
  "use strict";

  const BASE_WIDTH = 1138;
  const BASE_HEIGHT = 640;

  const PRESETS = {
    low: {
      key: "low",
      name: "Low",
      scale: 0.5,
      width: Math.round(BASE_WIDTH * 0.5),   // 569
      height: Math.round(BASE_HEIGHT * 0.5), // 320
      label: "Low (50%)",
      tagline: "Downscaled 50% (569x320) - Maximum FPS & Performance",
      desc: "Renders at half resolution (75% fewer pixels). Best for older laptops, phones, Chromebooks & iPads.",
      cullDistance: 1,
      defaultLdm: true,
      defaultGlow: false
    },
    medium: {
      key: "medium",
      name: "Medium",
      scale: 0.75,
      width: Math.round(BASE_WIDTH * 0.75),   // 854
      height: Math.round(BASE_HEIGHT * 0.75), // 480
      label: "Medium (75%)",
      tagline: "Downscaled 75% (854x480) - Balanced Quality & Speed",
      desc: "Renders at 75% resolution (44% fewer pixels). Smooth frame pacing with great visual clarity.",
      cullDistance: 2,
      defaultLdm: false,
      defaultGlow: true
    },
    high: {
      key: "high",
      name: "High",
      scale: 1.0,
      width: BASE_WIDTH,   // 1138
      height: BASE_HEIGHT, // 640
      label: "High (100%)",
      tagline: "Native 100% (1138x640) - Maximum Crispness",
      desc: "Full native resolution. Sharpest visuals with all effects and details active.",
      cullDistance: 3,
      defaultLdm: false,
      defaultGlow: true
    }
  };

  class GraphicsManager {
    constructor() {
      this.PRESETS = PRESETS;
      this.BASE_WIDTH = BASE_WIDTH;
      this.BASE_HEIGHT = BASE_HEIGHT;
      this.currentQuality = this.getQuality();
      const initialPreset = PRESETS[this.currentQuality] || PRESETS.high;
      this.currentScale = initialPreset.scale;
      this._init();
    }

    _init() {
      const q = this.getQuality();
      const preset = PRESETS[q] || PRESETS.high;
      this.currentQuality = preset.key;
      this.currentScale = preset.scale;

      if (typeof window !== "undefined") {
        window.__graphicsQuality = preset.key;
        window.__graphicsResolutionScale = preset.scale;

        // Apply quality preset defaults if not previously overridden by the user
        if (typeof localStorage !== "undefined") {
          if (preset.key === "low" && localStorage.getItem("webdash_user_ldm") === null) {
            window.enableLDM = true;
          }
          if (preset.key === "low" && localStorage.getItem("webdash_user_glow") === null) {
            window.showGlow = false;
          }
        }
      }
    }

    getQuality() {
      if (typeof localStorage === "undefined") return "high";
      try {
        const saved = localStorage.getItem("webdash_graphics_quality");
        return (saved && PRESETS[saved]) ? saved : "high";
      } catch (_) {
        return "high";
      }
    }

    getPreset(quality) {
      const q = quality || this.getQuality();
      return PRESETS[q] || PRESETS.high;
    }

    getResolutionScale() {
      return this.getPreset().scale;
    }

    getFiltering() {
      if (typeof localStorage === "undefined") return "smooth";
      try {
        return localStorage.getItem("webdash_graphics_filter") || "smooth";
      } catch (_) {
        return "smooth";
      }
    }

    setFiltering(filterMode) {
      if (typeof localStorage !== "undefined") {
        try {
          localStorage.setItem("webdash_graphics_filter", filterMode);
        } catch (_) {}
      }
      this.applyFilteringToCanvas();
    }

    applyFilteringToCanvas() {
      if (typeof document === "undefined") return;
      const filter = this.getFiltering();
      const canvases = document.querySelectorAll("canvas");
      canvases.forEach(cvs => {
        if (filter === "pixelated") {
          cvs.style.imageRendering = "pixelated";
        } else {
          cvs.style.imageRendering = "auto";
        }
      });
    }

    setQuality(quality, scene) {
      if (!PRESETS[quality]) quality = "high";
      this.currentQuality = quality;
      const preset = PRESETS[quality];
      this.currentScale = preset.scale;

      if (typeof localStorage !== "undefined") {
        try {
          localStorage.setItem("webdash_graphics_quality", quality);
        } catch (_) {}
      }

      if (typeof window !== "undefined") {
        window.__graphicsQuality = quality;
        window.__graphicsResolutionScale = preset.scale;

        if (quality === "low") {
          window.enableLDM = true;
          window.cullDistance = 1;
        } else if (quality === "medium") {
          window.cullDistance = 2;
        } else {
          window.cullDistance = 3;
        }

        if (window.PerformanceOptimizer && typeof window.PerformanceOptimizer.getStats === "function") {
          window.PerformanceOptimizer.cullDistance = window.cullDistance;
        }
      }

      this.applyToGame(scene);
      this.applyFilteringToCanvas();
    }

    applyToGame(scene) {
      const preset = this.getPreset(this.currentQuality);
      const targetW = preset.width;
      const targetH = preset.height;
      const scale = preset.scale;

      const game = (scene && scene.game) || (typeof window !== "undefined" && window.__wdGameInstance);
      if (!game) return;

      // 1. Resize Game ScaleManager to downscaled resolution
      if (game.scale && typeof game.scale.setGameSize === "function") {
        try {
          game.scale.setGameSize(targetW, targetH);
        } catch (e) {
          console.warn("[GraphicsManager] Scale resize error:", e);
        }
      }

      // 2. Adjust Camera on Active Scenes
      const applyCameraScale = (sc) => {
        if (!sc || !sc.cameras || !sc.cameras.main) return;
        try {
          const cam = sc.cameras.main;
          cam.setSize(targetW, targetH);
          cam.setZoom(scale);
          cam.setOrigin(0, 0);
        } catch (e) {
          console.warn("[GraphicsManager] Camera scale error:", e);
        }
      };

      if (scene) applyCameraScale(scene);
      if (game.scene && game.scene.scenes) {
        game.scene.scenes.forEach(applyCameraScale);
      }

      this.applyFilteringToCanvas();
    }
  }

  window.GraphicsManager = new GraphicsManager();
})();
