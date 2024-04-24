#!/usr/bin/env -S deno run -A

export function commonPrefix(strA: string, strB: string): string {
  let i = 0
  while (strA.at(i) === strB.at(i)) {
    i++
  }
  return strA.substring(0, i)
}

if (import.meta.main) {
  const process = await import("node:process")
  if (process.argv.length < 2) {
    console.error(`Too few arguments!`)
    process.exit(1)
  }

  const [strA, strB] = process.argv.slice(2)

  console.log(commonPrefix(strA, strB))
}
