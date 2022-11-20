#!/usr/bin/env ts-node

export function commonPrefix(strA: string, strB: string): string {
  let i = 0
  while (strA.at(i) === strB.at(i)) {
    i++
  }
  return strA.substring(0, i)
}

if (module.id === ".") {
  if (process.argv.length < 2) {
    console.error(`Too few arguments!`)
    process.exit(1)
  }

  const [strA, strB] = process.argv.slice(2)

  console.log(commonPrefix(strA, strB))
}
