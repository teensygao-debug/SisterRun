export class AssetManager {
  constructor({ manifestUrl = "./assets/assets.json", loader = null } = {}) {
    this.manifestUrl = manifestUrl;
    this.loader = loader;
    this.manifest = null;
    this.assets = new Map();
  }

  async loadManifest() {
    const response = await fetch(this.manifestUrl);
    if (!response.ok) {
      throw new Error(`Failed to load asset manifest: ${this.manifestUrl}`);
    }
    this.manifest = await response.json();
    this.validateManifest(this.manifest);
    return this.manifest;
  }

  validateManifest(manifest) {
    if (!manifest || manifest.schemaVersion !== "visual-freeze-assets/v1") {
      throw new Error("Invalid SisterRun asset manifest schema.");
    }
    if (!manifest.rules?.noMixedAssets) {
      throw new Error("Asset manifest must enforce noMixedAssets.");
    }
    if (manifest.rules.spriteSize !== 64) {
      throw new Error("Visual Freeze sprites must be 64 x 64 px.");
    }
  }

  getManifest() {
    if (!this.manifest) {
      throw new Error("Asset manifest has not been loaded.");
    }
    return this.manifest;
  }

  getSpriteSpec(group, state) {
    const manifest = this.getManifest();
    const groupSpec = manifest.sprites?.[group];
    const stateSpec = groupSpec?.states?.[state];
    if (!groupSpec || !stateSpec) {
      throw new Error(`Missing sprite spec: ${group}.${state}`);
    }
    return {
      ...stateSpec,
      group,
      state,
      basePath: groupSpec.basePath,
      frameSize: groupSpec.frameSize,
      baselineY: groupSpec.baselineY
    };
  }
}
