#!/usr/bin/env -S deno run

import path from 'node:path'

export function rootname(fn: string): string {
  return fn.substring(0, fn.length - path.extname(fn).length)
}

if (import.meta.main) {
  (async () => {
    const process = await import("node:process")
    for (const fn of process.argv.slice(2)) {
      console.log(rootname(fn))
    }
  })()
}
