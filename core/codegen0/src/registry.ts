export type RegistryEntry = {modTimeMs: number, source: string}

export class SourceRegistry {
  entries: Map<string, RegistryEntry>

  constructor() {
    this.entries = new Map
  }

  setFile(path: string, source: string, modTimeMs?: number): RegistryEntry {
    if (modTimeMs == null) {
      modTimeMs = Date.now()
    }
    this.entries.set(path, {source, modTimeMs})
    return {source, modTimeMs}
  }

  get(path: string): RegistryEntry | undefined {
    return this.entries.get(path)
  }
}
