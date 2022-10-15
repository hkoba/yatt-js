#!/usr/bin/env ts-node

import {paragraph} from './paragraph'

import {count_newlines} from 'lrxml'

export type XHF_Token = {
  name: string | null
  sigil: string
  value: string
  lineno: number
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

const CLO: {[k: string]: string}       = {']': '[',  '}': '{'}
const NAMELESS: {[k: string]: boolean} = {']': true, '}': true, '-': true}

type Match = {name: string, sigil: string, tabsp?: string, eol?: string}

export function* tokenizer(str: string): Generator<XHF_Token> {
  let lineno = 1
  for (const para of paragraph(str)) {
    for (const item of para[0].split(/(?<=\n)(?=[^\ \t])/)) {
      // console.log(lineno, item)
      if (item === "" || /^\#/.test(item)) {
        lineno += count_newlines(item); continue
      }
      let match = item.match(re_item)
      if (! match)
        throw new Error(`Invalid XHF token ((${item}))`)
      let mg = match.groups as Match

      if (mg.name === '') {
        if (mg.sigil === ':')
          throw new Error(`Invalid XHF token(name is empty for ${match})`)
      }
      else if (NAMELESS[mg.sigil]) {
        throw new Error(`Invalid XHF token('${mg.sigil}' should not be prefixed by name ${mg.name})`)
      }

      // if (mg.sigil === '#') {
      //   lineno++; continue
      // }

      const name = CLO[mg.sigil] ? null : mg.name

      let value = item.
        substring(match[0].length).
        replaceAll(/\n[\ \t]/g, '\n')

      if (mg.eol) {
        // verbatim mode
        value = value.replace(/^[\ \t]/, '')
      } else {
        value = value.trim()
      }

      yield {name, value, sigil: mg.sigil, lineno}

      lineno += count_newlines(item)
    }

    lineno += para[1]
  }
}

if (module.id === ".") {
  (async () => {
    const fs = await import('fs')

    // console.log(re_item)

    for (const fileName of process.argv.slice(2)) {
      const str = fs.readFileSync(fileName, {encoding: 'utf-8'})
      for (const item of tokenizer(str)) {
        console.dir(item, {colors: true, depth: null})
      }
    }
  })()
}
