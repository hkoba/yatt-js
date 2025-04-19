import type {YattBuildConfig} from './context.ts'

import { loadIfModified } from './load.ts'

export type RegistryEntry = {modTimeMs: number, source: string}

export type SourceLoader = (path: string, modTimeMs?: number, debug?: number) => Promise<RegistryEntry | undefined>

export class SourceRegistry {
  loader?: SourceLoader
  entries: Map<string, RegistryEntry>

  constructor(config: YattBuildConfig) {
    // 本当は外から sourceLoader を渡す方が今風。
    // けど、それだと loader の default 実装を探すのが面倒。
    // なので、あえて config を取る interface にした。

    this.loader = Object.hasOwn(config, 'sourceLoader')
      ? config.sourceLoader : loadIfModified

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
