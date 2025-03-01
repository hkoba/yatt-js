#!/usr/bin/env -S deno run -RE

declare global {
  interface ImportMeta {main: boolean}
}

import {LrxmlConfig} from '../config.ts'

import {
  AnyToken, Range, GlobalMatch, ParserContext, parserContext
} from '../context.ts'
import { re_join } from '../utils/regexp.ts'

import { AttToken, tokenize_attlist } from '../attlist/tokenize.ts'

export type MPText      = {kind: "text"}       & AnyToken
export type MPComment   = {kind: "comment", innerRange: Range}    & AnyToken
export type MPDeclBegin = {kind: "decl_begin", detail: string} & AnyToken
export type MPDeclEnd   = {kind: "decl_end"}   & AnyToken

export type Chunk = MPText | MPComment | MPDeclBegin | AttToken | MPDeclEnd

type DeclMatch = { comment?: string, declname?: string, prefix?: string }

function re_decl_open(ns: string[]): RegExp {
  const nspat = ns.join("|")
  const pat = '<!' + re_join(
    // <!--#yatt
    // <!--#yatt:foo:bar
    `(?<comment>--#${nspat}(?::\\w+)*)`,
    
    // <!yatt:widget
    // <!yatt:widget:type
    `(?<declname>${nspat}:\\w+(?::\\w+)*)`
  )
  
  return new RegExp(pat, 'g')
}

export type ChunkGenerator = Generator<Chunk, any, any>;

export function* tokenize_multipart(
  source: string, config: {filename?: string} & LrxmlConfig
) {
  const {filename, ..._config} = config;
  let ctx = parserContext({filename, source, config: _config})
  yield* tokenize_multipart_context(ctx)
}

export function* tokenize_multipart_context(ctx: ParserContext): ChunkGenerator {
  let re_decls = ctx.re('decls', () => re_decl_open(ctx.session.params.namespace))
  let re_comment_end = ctx.session.params.compat_end_of_comment ?
    /(?<prefix>.*?)-->/sy :
    /(?<prefix>.*?)#-->/sy;
  let re_decl_end = />\r?\n/y;
  
  let globalMatch: GlobalMatch | null = null
  while ((globalMatch = ctx.global_match(re_decls)) !== null) {
    const prefix = ctx.prefix_of(globalMatch)
    if (prefix != null) {
      yield { kind: "text", ...ctx.tab_range(prefix) }
    }

    if (globalMatch.match.groups == null) continue

    const dm: DeclMatch = globalMatch.match.groups

    if (dm.comment != null) {
      const line = ctx.line
      ctx.tab_match(globalMatch.match)
      const end = ctx.match_index(re_comment_end)
      if (!end || !end.groups) {
        // XXX: compat_end_of_comment
        ctx.throw_error("Comment is not closed by '#-->'!", { index: globalMatch.match.index })
      }
      const innerRange = ctx.contained_string_range(globalMatch, end.groups.prefix)
      if (innerRange == null) {
        ctx.NEVER()
      }
      const comment = ctx.tab(globalMatch, end)
      yield { kind: "comment", innerRange, line, start: comment.start, end: comment.end }
    } else if (dm.declname != null) {
      // <!yatt:widget ...
      yield {
        kind: "decl_begin", detail: dm.declname,
        ...ctx.tab(globalMatch)
      }

      // name name="value" name=[name name="value"...]...
      yield* tokenize_attlist(ctx, '%')

      // console.log("REST: ", ctx.remainder(3))

      const end = ctx.match_index(re_decl_end)
      if (!end) {
        // XXX: yatt vs lrxml
        ctx.throw_error("yatt declaration is not closed", { index: globalMatch.match.index })
      }
      yield { kind: "decl_end", ...ctx.tab_match(end) }
    } else {
      ctx.throw_error("Unknown case!")
    }
  }
  
  const rest = ctx.rest_range()
  if (rest != null) {
    yield {kind: "text", line: ctx.line, ...rest}
  }
}

if (import.meta.main) {
  (async () => {
    const process = await import("node:process")
    const { readFileSync } = await import("node:fs")
    const [_cmd, _script, ...args] = process.argv;
    const { parse_long_options } = await import("../utils/long-options.ts")
    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0

    let config: LrxmlConfig = {
      debug: { parser: debugLevel }
    }
    parse_long_options(args, {target: config})

    for (const fn of args) {
      const source = readFileSync(fn, { encoding: "utf-8" })
      let lex = tokenize_multipart(source, {
        filename: fn, ...config
      })

      process.stdout.write(JSON.stringify({FILENAME: fn}) + "\n")
      for (const tok of lex) {
        process.stdout.write(JSON.stringify({
          TOKEN: tok, PAYLOAD: source.substring(tok.start, tok.end)
        }) + "\n")
      }
      process.stdout.write("\n")
    }
  })()
}
