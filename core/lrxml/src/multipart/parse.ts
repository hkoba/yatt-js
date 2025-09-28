#!/usr/bin/env -S deno run -RE

declare global {
  interface ImportMeta {main: boolean}
}

import type {LrxmlConfig} from '../config.ts'
import type {
  AnyToken, Range, ParserContext, ParserSession
} from '../context.ts'
import {parserContext} from '../context.ts'

import { tokenize_multipart_context } from './tokenize.ts'

import { type AttItem, parse_attlist} from '../attlist/parse.ts'

export type Content = Boundary | Payload

export type Payload = AnyToken & {kind: "text", data: string} |
  AnyToken & {kind: "comment", data: string, innerRange: Range}

// yatt:widget:html
// ↓
// namespace: 'yatt'
// kind: 'boundary'
// decltype: ['widget', 'html']

export type Boundary = {
  kind: 'boundary'
  filename?: string
  namespace: string
  decltype: string[]
  attlist: AttItem[]
} & AnyToken

export type BoundaryAndPayloads = {boundary: Boundary, payloads: Payload[]}

export function pair_boundary_and_payload(
  contentList: Content[]
): BoundaryAndPayloads[] {
  let result: BoundaryAndPayloads[] = []
  for (const content of contentList) {
    switch (content.kind) {
      case "boundary": {
        result.push({boundary: content, payloads: []})
        break;
      }
      case "text":
      case "comment": {
        if (result.length === 0) {
          throw new Error(`contents doesn't start from yatt declaration!`)
        }
        result[result.length-1].payloads.push(content)
        break;
      }
    }
  }
  return result
}

export function parse_multipart(
  source: string, config: {filename?: string} & LrxmlConfig
): [Content[], ParserSession] {
  const {filename = "dummy.ytjs", ..._config} = config;
  const ctx = parserContext({filename, source, config: _config})
  return [parse_multipart_context(ctx), ctx.session]
}

type Start = {line: number, start: number}

export function parse_multipart_context(ctx: ParserContext): Content[] {
  const itemList: Content[] = []
  const lex = tokenize_multipart_context(ctx)
  for (const tok of lex) {
    switch (tok.kind) {
      case "text": {
        itemList.push({kind: tok.kind, data: ctx.range_text(tok), ...tok});
        break;
      }
      case "comment": {
        if (tok.innerRange == null) {
          ctx.NEVER()
        }
        const {kind, line, start, end, innerRange} = tok
        itemList.push({kind, line, start, end, innerRange, data: ctx.range_text(tok)});
        break;
      }
      case "decl_begin": {
        const {line, start} = tok
        const [namespace, ...decltype] = tok.detail.split(/:/);
        const [attlist, end] = parse_attlist(ctx, lex, "decl_end")
        const boundary: Boundary = {
          kind: 'boundary',
          filename: ctx.session.filename,
          namespace, decltype, attlist,
          line, start, end: end.end
        }
        itemList.push(boundary)
        break;
      }
      default: {
        ctx.throw_error(`Unknown syntax error: kind=${tok.kind}`);
      }
    }
  }

  return itemList
}

// console.log(this)

if (import.meta.main) {
  (async () => {
    const process = await import("node:process")
    const { readFileSync } = await import('node:fs')
    const [_cmd, _script, ...args] = process.argv;
    const { parse_long_options } = await import("../utils/long-options.ts")
    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    const config: LrxmlConfig = {
      debug: { parser: debugLevel }
    }
    parse_long_options(args, {target: config})

    for (const fn of args) {
      const source = readFileSync(fn, { encoding: "utf-8" })
      const [partList, ] = parse_multipart(source, {
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
