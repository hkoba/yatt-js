#!/usr/bin/env ts-node

import {tokenizer, XHF_Token} from './tokenize'

// XXX: parse options like {filename?: string}

export function* parseAsArrayList(str: string) {
  yield* parser(str)
}

export function* parseAsObjectList(str: string) {
  for (const block of parser(str)) {
    yield block.length >= 2 ? Object.fromEntries(makeEntries(block)) : block[0]
  }
}

export function makeEntries(array: any[]) {
  if (array.length % 2 !== 0) {
    throw new Error(`Invalid XHF: Odd number of items: ${array}`)
  }
  return array.reduce(
    (p: any[], cur: any, i) => {
      return i % 2 == 0 ? [p, cur] : p[0].concat([[p[1], cur]])
    }, []
  )
}

export function* parser(str: string) {

  const lexer = tokenizer(str)
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

function parse_by_sigil(token: XHF_Token, lexer: Generator<XHF_Token>) {
  switch (token.sigil) {
    case '[':
      return parse_array(lexer)
    case '{':
      return parse_object(lexer)
    case '=':
      return parse_expression(token)
    case ':': case '-':
      return token.value
    default:
      throw new Error(`Invalid xhf token ${token}`)
  }
}

function parse_array(lexer: Generator<XHF_Token>): any[] {
  let result: any[] = []
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

function parse_object(lexer: Generator<XHF_Token>) {
  let entries: [string, any][] = []
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

function parse_expression(token: XHF_Token) {
  const match = token.value.match(/^\#(\w+)\s*/)
  if (! match) {
    throw new Error(`Not yet implemented XHF token: ${token}`)
  }
  if (! EXPR_KEYWORD.has(match[1])) {
    throw new Error(`Invalid XHF keyword: '= #${match[1]}'`)
  }
  return EXPR_KEYWORD.get(match[1])
}

if (module.id === ".") {
  (async () => {
    const fs = await import('fs')
    const {promisify} = await import('util')

    const write = promisify(process.stdout.write.bind(process.stdout))

    const args = process.argv.slice(2)

    const asJsonl = args.length >= 1 && args[0] === "-J" && args.shift() ?
      true : false

    const colors = process.stdout.isTTY

    for (const fileName of args) {
      const str = fs.readFileSync(fileName, {encoding: 'utf-8'})
      for (const item of parseAsObjectList(str)) {
        if (asJsonl) {
          await write(JSON.stringify(item) + "\n")
        } else {
          console.dir(item, {colors, depth: null})
        }
      }
    }
  })()
}
