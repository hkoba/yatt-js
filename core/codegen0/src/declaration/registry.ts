import { loadIfModified, testFile } from './load.ts'

export interface SourceConfig {
  sourceLoader?: SourceLoader
  sourceTester?: SourceTester
  files?: {[path: string]: string} | Map<string, string>
}

export type RegistryEntry = {modTimeMs: number, source: string, note?: any}

export type SourceLoader = (path: string, modTimeMs?: number, debug?: number) => Promise<RegistryEntry | undefined>

export type SourceTester = (path: string) => Promise<number | undefined>

export class SourceRegistry {
  tester?: SourceTester
  loader?: SourceLoader
  entries: Map<string, RegistryEntry>

  constructor(config: SourceConfig) {
    // 本当は外から sourceLoader を渡す方が今風だろうとは思う。
    // けど、それだと loader の default 実装を探すのが面倒。
    // なので、あえて config を取る interface にした。

    // null が来たら、null のままにする
    this.loader = Object.hasOwn(config, 'sourceLoader')
      ? config.sourceLoader : loadIfModified

    this.tester = Object.hasOwn(config, 'sourceTester')
      ? config.sourceTester : testFile

    this.entries = new Map

    if (config.files) {
      this.install(config.files)
    }
  }

  install(files: Map<string,string> | {[path: string]:string}): void {
    const modTimeMs = Date.now()
    const entries = files instanceof Map
      ? files.entries() : Object.entries(files)
    for (const [path, content] of entries) {
      this.setFile(path, content, modTimeMs)
    }
  }

  setFile(path: string, source: string, modTimeMs?: number, note?: any): RegistryEntry {
    if (modTimeMs == null) {
      modTimeMs = Date.now()
    }
    this.entries.set(path, {source, modTimeMs, note})
    return {source, modTimeMs}
  }

  has(path: string): boolean {
    return this.entries.has(path)
  }

  get(path: string): RegistryEntry | undefined {
    return this.entries.get(path)
  }

  async refresh(
    realPath: string, visited: boolean,
    source?: string, modTimeMs?: number, debug?: number
  ): Promise<{sourceEntry: RegistryEntry | undefined, updated: boolean}> {
    if (source != null) {
      return {
        sourceEntry: this.setFile(realPath, source, modTimeMs),
        updated: false
      }
    }

    let updated
    let sourceEntry = this.get(realPath)

    // If sourceLoader is explicitly null, skip refresh
    if (! this.loader) {
      return {sourceEntry, updated: false}
    }

    if (! sourceEntry) {
      sourceEntry = await this.loader(
        realPath, undefined, debug
      );
      if (sourceEntry) {
        this.setFile(realPath, sourceEntry.source, sourceEntry?.modTimeMs)
      }
    } else if (! visited) {
      updated = await this.loader(realPath, sourceEntry.modTimeMs, debug)
      if (updated) {
        sourceEntry = updated
        this.setFile(realPath, updated.source, updated.modTimeMs)
      }
    }

    return {sourceEntry, updated: updated != null}
  }
}
