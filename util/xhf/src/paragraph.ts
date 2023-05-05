#!/usr/bin/env ts-node

export type Paragraph = [string, number]

export function* paragraph(str: string): Generator<Paragraph> {
  const re = /(?<=\n)\n+/g
  let match, pos = 0
  while (match = re.exec(str)) {
    yield [str.substring(pos, match.index), match[0].length]
    pos = re.lastIndex
  }
  if (pos < str.length) {
    yield [str.substring(pos), 0]
  }
}

if (module.id === ".") {
  (async () => {
    const fs = await import('node:fs')

    for (const fileName of process.argv.slice(2)) {
      const str = fs.readFileSync(fileName, {encoding: 'utf-8'})
      for (const item of paragraph(str)) {
        console.dir(item, {colors: true, depth: null})
      }
    }
  })()
}
