#!/usr/bin/env -S deno run -RE

import {tokenizer, type XHF_Token} from './tokenize.ts'

import type {XHF_Options} from './options.ts'

type XHF_Item = string | XHF_Item[] | {[k: string]: XHF_Item} | XHF_ExpressionValue
type XHF_ExpressionValue = null | undefined

// XXX: parse options like {filename?: string}

export function* parseAsArrayList(
  str: string, options?: XHF_Options
) {
  yield* parser(str, options)
}

export function* parseAsObjectList(
  str: string, options?: XHF_Options
): Generator<{[k:string]: XHF_Item} | XHF_Item> {
  for (const block of parser(str, options)) {
    if (block.length % 2 == 0) {
      yield makeObjectFromKeyValueList(block)
    } else {
      throw new Error(`Invalid XHF: Odd number of items: ${JSON.stringify(block)}`)
    }
  }
}

export function makeObjectFromKeyValueList<T>(array: T[]): {[k: string]: T} {
  return Object.fromEntries(makeEntries(array))
}

export function makeEntries<T>(array: T[]): [T, T][] {
  if (array.length % 2 !== 0) {
    throw new Error(`Invalid XHF: Odd number of items: ${array}`)
  }
  return Array.from(
    {length: array.length / 2},
    (_, i) => [array[2*i], array[2*i + 1]]
  );
}

export function* parser(
  str: string, options?: XHF_Options
): Generator<XHF_Item[]> {

  const lexer = tokenizer(str, options)
  let chunk
  while (!(chunk = lexer.next()).done) {
    const result = []
    const chunkLexer = (function*(chunk) { for (const item of chunk) { yield item }})(chunk.value)
    let item
    while (!(item = chunkLexer.next()).done) {
      const token = item.value
      if (token.name == null) {
        throw new Error(`Invalid XHF: Field close '${token.sigil}' without open!`)
      }
      if (token.name !== '') {
        result.push(token.name)
      }
      result.push(parse_by_sigil(token, chunkLexer))
    }
    yield result
  }
}

function parse_by_sigil(token: XHF_Token, lexer: Generator<XHF_Token>)
: XHF_Item {
  // console.dir(token, {colors: true, depth: null})
  switch (token.sigil) {
    case '[':
      return parse_array(lexer)
    case '{':
      return parse_object(lexer)
    case '=':
      return parse_expression(token)
    case ':': case '-': case ',':
      return token.value
    default:
      throw new Error(`Invalid xhf token: name: ${token.name} sigil:${token.sigil} value:${token.value}`)
  }
}

function parse_array(lexer: Generator<XHF_Token>): XHF_Item[] {
  const result: XHF_Item[] = []
  let item
  while (!(item = lexer.next()).done) {
    const token = item.value
    // NAME:
    if (token.name === null) {
      if (token.sigil !== ']') {
        throw new Error(`Invalid XHF: paren mismatch. '['`)
      }
      return result
    }
    else if (token.name !== '') {
      result.push(token.name)
    }
    // VALUE
    result.push(parse_by_sigil(token, lexer))
  }

  throw new Error(`Invalid XHF: Missing close ']' for '['`)
}

function parse_object(lexer: Generator<XHF_Token>): {[k: string]: XHF_Item} {
  const entries: [string, any][] = []
  let item
  while (!(item = lexer.next()).done) {
    const token = item.value
    if (token.name === null) {
      if (token.sigil !== '}') {
        throw new Error(`Invalid XHF: paren mismatch. '{'`)
      }
      return Object.fromEntries(entries)
    }
    else if (token.sigil === '-') {
      const valItem = lexer.next()
      if (valItem.done) {
        throw new Error(`Invalid XHF hash: key '- ${token.value}' doesn\'t have value! `)
      }
      const value = parse_by_sigil(valItem.value, lexer)
      entries.push([token.value, value])
    }
    else {
      entries.push([token.name, parse_by_sigil(token, lexer)])
    }
  }

  throw new Error(`Invalid XHF: Missing close '}' for '{'`)
}

const EXPR_KEYWORD = new Map([
  ['null', null],
  ['undef', null],
])

function parse_expression(token: XHF_Token): XHF_ExpressionValue {
  const match = token.value.match(/^\#(\w+)\s*/)
  if (! match) {
    throw new Error(`Not yet implemented XHF token: ${token}`)
  }
  if (! EXPR_KEYWORD.has(match[1])) {
    throw new Error(`Invalid XHF keyword: '= #${match[1]}'`)
  }
  return EXPR_KEYWORD.get(match[1])
}

if (import.meta.main) {
  (async () => {
    const process = await import('node:process')
    const fs = await import('node:fs')
    const {promisify} = await import('node:util')

    const { parse_long_options } = await import('@yatt/lrxml')

    const write = promisify(process.stdout.write.bind(process.stdout))

    const args = process.argv.slice(2)

    const options = {}
    parse_long_options(args, {target: options})

    const asJsonl = args.length >= 1 && args[0] === "-J" && args.shift() ?
      true : false

    const colors = process.stdout.isTTY

    for (const fileName of args) {
      const str = fs.readFileSync(fileName, {encoding: 'utf-8'})
      for (const item of parseAsObjectList(str, options)) {
        if (asJsonl) {
          await write(JSON.stringify(item) + "\n")
        } else {
          console.dir(item, {colors, depth: null})
        }
      }
    }
  })()
}
