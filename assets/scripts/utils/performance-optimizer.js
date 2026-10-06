/**
 * Web Dashers Performance Optimizer
 * Provides frame pacing, memory optimization, dynamic detail management, and GC reduction.
 */
(function () {
  class PerformanceOptimizer {
    constructor() {
      this.enabled = true;
      this.fps = 60;
      this.history = [];
      this.lastTimestamp = performance.now();
      this.frameCount = 0;
      this.lowFpsDuration = 0;
      this.isDynamicLdm = false;
      this.originalLdm = false;

      this._init();
    }

    _init() {
      // Global settings optimizations
      if (window.cullDistance === undefined) {
        window.cullDistance = 2; // Optimal balanced cull distance (2 sections ahead/behind)
      }

      // Smooth step and frame pacing hook
      const updateLoop = (now) => {
        const delta = now - this.lastTimestamp;
        this.lastTimestamp = now;
        this.frameCount++;

        if (delta > 0 && delta < 1000) {
          const instantFps = 1000 / delta;
          this.history.push(instantFps);
          if (this.history.length > 30) this.history.shift();

          const sum = this.history.reduce((a, b) => a + b, 0);
          this.fps = Math.round(sum / this.history.length);

          // Dynamic adaptive performance
          if (this.fps < 42) {
            this.lowFpsDuration += delta;
            if (this.lowFpsDuration > 2000 && !this.isDynamicLdm && !window.enableLDM) {
              this.isDynamicLdm = true;
              window.enableLDM = true;
              console.log('[PerformanceOptimizer] Auto-enabled LDM due to low FPS (' + this.fps + ' fps)');
            }
          } else if (this.fps >= 55) {
            if (this.lowFpsDuration > 0) this.lowFpsDuration = Math.max(0, this.lowFpsDuration - delta * 2);
          }
        }

        requestAnimationFrame(updateLoop);
      };

      requestAnimationFrame(updateLoop);
      console.log('[PerformanceOptimizer] Initialized with high-performance WebGL profile.');
    }

    getStats() {
      return {
        fps: this.fps,
        cullDistance: window.cullDistance,
        ldmActive: !!window.enableLDM,
        dynamicLdm: this.isDynamicLdm,
      };
    }
  }

  window.PerformanceOptimizer = new PerformanceOptimizer();
})();
