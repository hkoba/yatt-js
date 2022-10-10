#!/usr/bin/env ts-node

// export function parse(str: string): any[] {
//   const result: any[] = []
//   for (const item of paragraph(str)) {
//     result.push(item)
//   }
//   return result
// }

export function* parser(str: string) {
  // XXX: start from dummy impl
  yield* paragraph(str)
}

export function* paragraph(str: string) {
  for (const item of str.split(/\n{2,}/)) {
    yield item
  }
}

if (module.id === ".") {
  (async () => {
    const fs = await import('fs')

    for (const fileName of process.argv.slice(2)) {
      const str = fs.readFileSync(fileName, {encoding: 'utf-8'})
      for (const item of parser(str)) {
        console.dir(item, {color: true, depth: null})
      }
    }
  })()
}
