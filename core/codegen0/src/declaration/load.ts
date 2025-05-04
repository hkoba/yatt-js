import {open} from 'node:fs/promises'

import type { RegistryEntry } from "./registry.ts";

export async function loadIfModified(
    path: string, modTimeMs?: number, debug?: number
): Promise<RegistryEntry | undefined> {

  let fh
  try {
    fh = await open(path)
    let stat = await fh.stat()

    if (modTimeMs == null) {
      if (debug) {
        console.log(`loadIfModified: First fetch: ${path}`)
      }
    } else if (stat.mtimeMs <= modTimeMs) {
      if (debug) {
        console.log(`loadIfModified: Latest: ${path}`)
      }
      return;
    } else {
      if (debug) {
        console.log(`loadIfModified: Need update: ${path}`)
      }
    }
    const source = await fh.readFile({encoding: 'utf-8'})
    stat = await fh.stat()

    return {source, modTimeMs: stat.mtimeMs}
  } catch (err) {
    if (err instanceof Error && err.name !== "NotFound") {
      throw err;
    } else if (debug) {
      console.log(`loadIfModified: NotFound: ${path}`, err)
    }
  } finally {
    await fh?.close()
  }
}

