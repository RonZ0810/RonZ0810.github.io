(function () {
  "use strict";
  const PREFIX = "flipstrike.v3";
  const read = (key, fallback) => { try { return { ...fallback, ...JSON.parse(localStorage.getItem(`${PREFIX}.${key}`) || "{}") }; } catch { return { ...fallback }; } };
  const write = (key, value) => { try { localStorage.setItem(`${PREFIX}.${key}`, JSON.stringify(value)); } catch {} };
  class SaveService {
    constructor() { this.db = null; }
    async open() {
      if (!window.indexedDB) return null;
      this.db = await new Promise((resolve) => {
        const req = indexedDB.open(PREFIX, 1);
        req.onupgradeneeded = () => req.result.createObjectStore("saves");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });
      return this.db;
    }
    async putSuspend(snapshot) { if (!this.db) await this.open(); if (!this.db) return write("suspend", snapshot); return new Promise((resolve) => { const tx = this.db.transaction("saves", "readwrite"); tx.objectStore("saves").put(snapshot, "suspend"); tx.oncomplete = resolve; tx.onerror = resolve; }); }
    async hasSuspend() { if (!this.db) await this.open(); if (!this.db) return !!localStorage.getItem(`${PREFIX}.suspend`); return new Promise((resolve) => { const req = this.db.transaction("saves").objectStore("saves").getKey("suspend"); req.onsuccess = () => resolve(req.result !== undefined); req.onerror = () => resolve(false); }); }
    async consumeSuspend() {
      if (!this.db) await this.open();
      if (!this.db) { const value = read("suspend", null); localStorage.removeItem(`${PREFIX}.suspend`); return value; }
      return new Promise((resolve) => { const tx = this.db.transaction("saves", "readwrite"), store = tx.objectStore("saves"), req = store.get("suspend"); req.onsuccess = () => { const value = req.result; store.delete("suspend"); tx.oncomplete = () => resolve(value); }; req.onerror = () => resolve(null); });
    }
  }
  const legacy = (() => { try { return JSON.parse(localStorage.getItem("flipstrike.stats.v1") || "null"); } catch { return null; } })();
  const progress = read("progress", { version: 3, unlockedLevel: Math.max(1, Math.min(101, (legacy?.bestLevel || 0) + 1)), endlessUnlocked: !!legacy?.endlessUnlocked, achievements: [], discovered: [], seenObstacles: [], best: {}, endlessBest: 0 });
  if (!Array.isArray(progress.seenObstacles)) progress.seenObstacles = [];
  const settings = read("settings", { muted: false, music: .55, effects: .7, reducedEffects: matchMedia("(prefers-reduced-motion: reduce)").matches, vibration: true });
  window.FlipStorage = { SaveService, progress, settings, saveProgress: () => write("progress", progress), saveSettings: () => write("settings", settings) };
})();
