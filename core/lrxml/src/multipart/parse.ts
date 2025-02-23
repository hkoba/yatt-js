#!/usr/bin/env -S deno run -A

declare global {
  interface ImportMeta {main: boolean}
}

import {LrxmlConfig} from '../config.ts'
import {
  AnyToken, Range, ParserContext, parserContext, ParserSession
} from '../context.ts'

import { tokenize_multipart_context } from './tokenize.ts'

import { AttItem, parse_attlist} from '../attlist/parse.ts'

export type Payload = AnyToken & {kind: "text", data: string} |
  AnyToken & {kind: "comment", data: string, innerRange: Range}

// yatt:widget:html
// ↓
// namespace: 'yatt'
// kind: 'widget'
// subkind: ['html']

export type PartBase = {
  filename?: string
  namespace: string
  kind: string
  subkind: string[]
  attlist: AttItem[]
  payload: Payload[]
}

export type Part = AnyToken & PartBase 

export function parse_multipart(
  source: string, config: {filename?: string} & LrxmlConfig
): [Part[], ParserSession] {
  const {filename, ..._config} = config;
  let ctx = parserContext({filename, source, config: _config})
  return [parse_multipart_context(ctx), ctx.session]
}

type Start = {line: number, start: number}

export function parse_multipart_context(ctx: ParserContext): Part[] {
  let partList: [Start, PartBase][] = []
  let lex = tokenize_multipart_context(ctx)
  for (const tok of lex) {
    switch (tok.kind) {
      case "text": {
        push_payload(ctx, partList, {
          kind: tok.kind, data: ctx.range_text(tok),
          ...ctx.token_range(tok)
        })
        break;
      }
      case "comment": {
        if (tok.innerRange == null) {
          ctx.NEVER()
        }
        push_payload(ctx, partList, {
          kind: tok.kind, data: ctx.range_text(tok),
          innerRange: tok.innerRange,
          ...ctx.token_range(tok)
        })
        break;
      }
      case "decl_begin": {
        let [namespace, kind, ...subkind] = tok.detail.split(/:/);
        const [attlist, end] = parse_attlist(ctx, lex, "decl_end")
        let part: PartBase = {
          filename: ctx.session.filename,
          namespace, kind, subkind, attlist, payload: []
        }
        partList.push([{line: tok.start, start: tok.start}, part])
        break;
      }
      default: {
        ctx.throw_error(`Unknown syntax error: kind=${tok.kind}`);
      }
    }
  }
  return add_range<PartBase>(partList, ctx.end)
}

function add_range<T>(list: [Start, T][], end: number): (T & Range & {line: number})[] {
  let result: (T & Range & {line: number})[] = []
  let [cur, ...rest] = list
  for (const nx of rest) {
    const range = {...cur[0], end: nx[0].start}
    result.push({...range, ...cur[1]})
    cur = nx
  }
  if (cur != null) {
    const range = {...cur[0], end}
    result.push({...range, ...cur[1]})
  }
  return result
}

function push_payload(ctx: ParserContext, partList: [Start, PartBase][], payload: Payload) {
  if (! partList.length) {
    // May fill default kind/namespace
    partList.push([{start: 0, line: 1}, {
      filename: ctx.session.filename,
      kind: "", namespace: "", subkind: [], attlist: [], payload: []
    }])
  }
  partList[partList.length-1][1].payload.push(payload)
}

// console.log(this)

if (import.meta.main) {
  (async () => {
    const process = await import("node:process")
    const { readFileSync } = await import('node:fs')
    const [_cmd, _script, ...args] = process.argv;
    const { parse_long_options } = await import("../utils/long-options.ts")
    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    let config: LrxmlConfig = {
      debug: { parser: debugLevel }
    }
    parse_long_options(args, {target: config})

    for (const fn of args) {
      const source = readFileSync(fn, { encoding: "utf-8" })
      let [partList, ] = parse_multipart(source, {
        filename: fn, ...config
      })
      process.stdout.write(JSON.stringify({FILENAME: fn}) + "\n")
      for (const part of partList) {
        process.stdout.write(JSON.stringify(part) + "\n")
      }
      process.stdout.write("\n")
    }
  })()
}
