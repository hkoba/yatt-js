#!/usr/bin/env ts-node

import {LrxmlConfig} from '../config'
import {
  Range, ParserContext, parserContext, ParserSession
} from '../context'

import { tokenize_multipart_context } from './tokenize'

import { AttItem, parse_attlist} from '../attlist/parse'

export type Payload = {kind: "text", data: string} & Range |
  {kind: "comment", data: string, innerRange: Range} & Range

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

export type Part = PartBase & Range

export function parse_multipart(
  source: string, config: {filename?: string} & LrxmlConfig
): [Part[], ParserSession] {
  const {filename, ..._config} = config;
  let ctx = parserContext({filename, source, config: _config})
  return [parse_multipart_context(ctx), ctx.session]
}

export function parse_multipart_context(ctx: ParserContext): Part[] {
  let partList: [number, PartBase][] = []
  let lex = tokenize_multipart_context(ctx)
  for (const tok of lex) {
    switch (tok.kind) {
      case "text": {
        push_payload(ctx, partList, {
          kind: tok.kind, data: ctx.range_text(tok),
          ...(tok as Range)
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
          ...(tok as Range)
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
        partList.push([tok.start, part])
        break;
      }
      default: {
        ctx.throw_error(`Unknown syntax error: kind=${tok.kind}`);
      }
    }
  }
  return add_range<PartBase>(partList, ctx.end)
}

function add_range<T>(list: [number, T][], end: number): (T & Range)[] {
  let result: (T & Range)[] = []
  let [cur, ...rest] = list
  for (const nx of rest) {
    const range = {start: cur[0], end: nx[0]}
    result.push({...range, ...cur[1]})
    cur = nx
  }
  if (cur != null) {
    const range = {start: cur[0], end}
    result.push({...range, ...cur[1]})
  }
  return result
}

function push_payload(ctx: ParserContext, partList: [number, PartBase][], payload: Payload) {
  if (! partList.length) {
    // May fill default kind/namespace
    partList.push([0,{
      filename: ctx.session.filename,
      kind: "", namespace: "", subkind: [], attlist: [], payload: []
    }])
  }
  partList[partList.length-1][1].payload.push(payload)
}

// console.log(this)

if (module.id === ".") {
  (async () => {
    const { readFileSync } = await import('fs')
    const [_cmd, _script, ...args] = process.argv;
    const { parse_long_options } = await import("../utils/long-options")
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
