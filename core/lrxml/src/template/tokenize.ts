#!/usr/bin/env ts-node

import {LrxmlConfig} from '../config'
import {
  Range, ParserContext, ParserSession
} from '../context'

import { Payload } from '../multipart/parse'

import { tokenize_attlist, AttToken } from '../attlist/tokenize'

import { parse_entpath, re_entity_open, re_lcmsg, EntNode, EntPrefixMatch, LCMsg } from '../entity/parse'

import { re_join, re_lookahead } from '../utils/regexp'

function re_body(ns: string[]): RegExp {
  const nspat = ns.join("|")
  const entOpen = re_entity_open(ns, '&') +
    re_lookahead(':', re_lcmsg())
  const inTagOpen = re_join(
    `(?<clo>/)?(?<opt>:)?(?<tag>${nspat}(?::\\w+)+)`,
    `\\?(?<pi>${nspat}(?::\\w+)*)`
  )
  const body = re_join(
    entOpen,
    `<${inTagOpen}\\b`
  )
  return new RegExp(body, 'g')
}

type BodyMatch = {
  prefix: string
  clo?: string
  opt?: string
  tag?: string
  pi?: string
} & EntPrefixMatch

type Text = Range & {kind: "text"}
type Comment = Range & {kind: "comment", innerRange: Range}
type PI = Range & {kind: "pi", innerRange: Range}

type TagOpen  = Range & {kind: "tag_open", name: string,
                         is_close: boolean, is_option: boolean}
export type TagClose = Range & {kind: "tag_close", is_empty_element: boolean}

// Entity
type EntOpen = Range & {kind: "entpath_open", name: string}

export type Token = Text | Comment | PI |
  TagOpen | AttToken | TagClose | EntOpen | EntNode | LCMsg

export function* tokenize(session: ParserSession, payloadList: Payload[]): Generator<Token,any,any>
  {
  let outerCtx = new ParserContext(session);
  let re = outerCtx.re('body', () => re_body(session.params.namespace))
  for (const tok of payloadList) {
    if (tok.kind === "comment") {
      yield tok
    } else if (tok.kind === "text") {
      let ctx = outerCtx.narrowed(tok)
      let globalMatch
      while ((globalMatch = ctx.global_match(re))) {
        const prefix = ctx.prefix_of(globalMatch)
        if (prefix != null) {
          yield { kind: "text", ...prefix }
        }
        
        let bm = globalMatch.match.groups as BodyMatch
        if (bm.entity != null) {
          // XXX: This must be handled in attlist too.
          if (bm.lcmsg != null) {
            const range = ctx.tab(globalMatch, undefined, bm.lcmsg)
            const end = ctx.match_index(/;/y);
            if (end == null) {
              // XXX: never type
              throw ctx.throw_error("lcmsg entity is not terminated with ;")
            }

            if (bm.msgopn) {
              yield {kind: "lcmsg_open", namespace: bm.entity.split(/:/)
                     , start: range.start, end: end.index}
            }
            else {
              const kind = bm.msgsep ? "lcmsg_sep"
                : bm.msgclo ? "lcmsg_close" : null;
              if (kind == null) {
                throw ctx.throw_error("BUG: unknown condition");
              }

              yield { kind, start: range.start, end: end.index }
            }

          } else {
            const range = ctx.tab(globalMatch)
            yield {kind: "entpath_open", name: ctx.range_text(range), ...range}

            yield parse_entpath(ctx)
          }
        }
        else if (bm.tag != null) {
          
          const range = ctx.tab(globalMatch)
          yield {kind: "tag_open",
                 is_close: bm.clo != null,
                 is_option: bm.opt != null,
                 name: bm.tag, ...range}
          yield* tokenize_attlist(ctx, '&')
          const end = ctx.match_index(/(?<empty_tag>\/)?>(\r?\n)?/y)
          if (end == null) {
            const gbg = ctx.match_index(/\S*\s*?\/?>/y)
            if (gbg) {
              ctx.throw_error("Garbage before CLO(>)")
            } else {
              ctx.throw_error("Missing CLO(>)")
            }
            return; // NOT REACHED
          }
          yield {kind: "tag_close",
                 is_empty_element: end.groups && end.groups.empty_tag != null ? true : false,
                 ...ctx.tab_string(end[0])}
        }
        else if (bm.pi != null) {
          const range = ctx.tab(globalMatch)
          const end = ctx.match_index(/.*?\?>/sy)
          if (end == null) {
            ctx.throw_error("Missing ?>")
            return; // NOT REACHED
          }
          const innerRange = {start: range.end, end: end.index}
          yield {kind: "pi", innerRange, ...range}
        }
        else {
          ctx.NEVER()
        }
      }
      
      const rest = ctx.rest_range()
      if (rest != null) {
        yield {kind: "text", ...rest}
      }

    } else {
      // never
    }
  }
}

if (module.id === ".") {
  const { readFileSync } = require('fs')
  const [_cmd, _script, ...args] = process.argv;
  const { parse_multipart } = require('../multipart/parse')
  const { parse_long_options } = require("../utils/long-options")
  const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
  const config: LrxmlConfig = {
    debug: { parser: debugLevel }
  }
  parse_long_options(args, {target: config})
  
  for (const fn of args) {
    const source = readFileSync(fn, { encoding: "utf-8" })
    let [partList, session] = parse_multipart(source, {
      filename: fn, ...config
    })

    process.stdout.write(JSON.stringify({FILENAME: fn}) + "\n")
    for (const part of partList) {
      process.stdout.write(JSON.stringify({part: part.kind, attlist: part.attlist}) + "\n")
      for (const tok of tokenize(session, part.payload)) {
        const text = session.range_text(tok)
        process.stdout.write(JSON.stringify([tok, text]) + "\n")
      }
    }
    process.stdout.write("\n")
  }

}
