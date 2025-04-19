import {open} from 'node:fs/promises'

import type { RegistryEntry } from "../registry.ts";

export class DefaultSourceRefresher {
  async refresh(
    path: string, modTimeMs?: number, debug?: number
  ): Promise<RegistryEntry | undefined> {

    let fh
    try {
      fh = await open(path)
      let stat = await fh.stat()

      if (modTimeMs == null) {
        if (debug) {
          console.log(`Cache: First fetch: ${path}`)
        }
      } else if (stat.mtimeMs <= modTimeMs) {
        if (debug) {
          console.log(`Cache: Latest: ${path}`)
        }
        return;
      } else {
        if (debug) {
          console.log(`Cache: Need update: ${path}`)
        }
      }
      const source = await fh.readFile({encoding: 'utf-8'})
      stat = await fh.stat()

      return {source, modTimeMs: stat.mtimeMs}
    } catch (err) {
      if (err instanceof Error && err.name !== "NotFound") {
        console.warn(err)
      } else if (debug) {
        console.log(`Cache: Can't read: ${path}`, err)
      }
    } finally {
      await fh?.close()
    }
  }
}
