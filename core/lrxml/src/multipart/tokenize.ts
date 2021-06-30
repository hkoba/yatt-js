#!/usr/bin/env ts-node

import {LrxmlConfig} from '../config'

import {
  Range, GlobalMatch, ParserContext, parserContext
} from '../context'
import { re_join } from '../utils/regexp'

import { AttToken, tokenize_attlist } from '../attlist/tokenize'

export type Text      = {kind: "text"}       & Range
export type Comment   = {kind: "comment", innerRange: Range}    & Range
export type DeclBegin = {kind: "decl_begin", detail: string, lineNo: number} & Range
export type DeclEnd   = {kind: "decl_end"}   & Range

export type Chunk = Text | Comment | DeclBegin | AttToken | DeclEnd

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
      yield { kind: "text", ...prefix }
    }

    if (globalMatch.match.groups == null) continue

    const dm: DeclMatch = globalMatch.match.groups

    if (dm.comment != null) {
      ctx.tab_string(globalMatch.match[0])
      const end = ctx.match_index(re_comment_end)
      if (!end || !end.groups) {
        ctx.throw_error("Comment is not closed by '#-->'!", { index: globalMatch.match.index })
      }
      const innerRange = ctx.contained_string_range(globalMatch, end.groups.prefix)
      if (innerRange == null) {
        ctx.NEVER()
      }
      const comment = ctx.tab(globalMatch, end)
      yield { kind: "comment", innerRange, ...comment }
    } else if (dm.declname != null) {
      // <!yatt:widget ...
      yield {
        kind: "decl_begin", detail: dm.declname,
        lineNo: ctx.line_number(globalMatch.match.index),
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

      yield { kind: "decl_end", ...ctx.tab_string(end[0]) }
    } else {
      ctx.throw_error("Unknown case!")
    }
  }
  
  const rest = ctx.rest_range()
  if (rest != null) {
    yield {kind: "text", ...rest}
  }
}

if (module.id === ".") {
  const { readFileSync } = require("fs")
  const [_cmd, _script, ...args] = process.argv;
  const { parse_long_options } = require("../utils/long-options")
  const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0

  const config: LrxmlConfig = {
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
}
