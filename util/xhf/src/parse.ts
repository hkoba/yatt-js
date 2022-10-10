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
  yield* tokenizer(str)
}

const cc_name   =    "[0-9A-Za-z_\\.\\-/~!]";
const re_suffix = "\\[[0-9A-Za-z_\\.\\-/~!]*\\]";
const cc_sigil  = "[:\\#,\\-=\\[\\]\\{\\}]";
const cc_tabsp  = "[\\ \\t]";

const re_item = new RegExp(
  `^(?<name>${cc_name}*(?:${re_suffix})*)`
    + `(?<sigil>${cc_sigil})`
    + `(?:(?<tabsp>${cc_tabsp})|(?<eol>\n|$))`
)

type Match = {name?: string, sigil?: string, tabsp?: string, eol?: string}

export function* tokenizer(str: string) {
  for (const para of paragraph(str)) {
    for (const item of para.split(/(?<=\n)(?=[^\ \t])/)) {
      if (item === "" || /^\#/.test(item))
        continue
      let match = item.match(re_item)
      if (! match)
        throw new Error(`Invalid XHF token ((${item}))`)
      let mg = match.groups as Match

      let value = item.substring(match[0].length)

      yield [mg.name, mg.sigil, value]
    }
  }
}

export function* paragraph(str: string) {
  for (const item of str.split(/\n{2,}/)) {
    yield item
  }
}

if (module.id === ".") {
  (async () => {
    const fs = await import('fs')

    console.log(re_item)

    for (const fileName of process.argv.slice(2)) {
      const str = fs.readFileSync(fileName, {encoding: 'utf-8'})
      for (const item of parser(str)) {
        console.dir(item, {color: true, depth: null})
      }
    }
  })()
}
