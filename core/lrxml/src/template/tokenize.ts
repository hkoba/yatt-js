#!/usr/bin/env -S deno run -RE

import {LrxmlConfig} from '../config.ts'
import {
  AnyToken, Range, ParserContext, ParserSession
} from '../context.ts'

import { Payload } from '../multipart/parse.ts'

import { tokenize_attlist, AttToken } from '../attlist/tokenize.ts'

import { parse_entpath, re_entity_open, re_lcmsg, EntNode, EntPrefixMatch, LCMsgToken } from '../entity/parse.ts'

import { re_join, re_lookahead } from '../utils/regexp.ts'

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

export type Text = AnyToken & {kind: "text", lineEndLength: number}
export type Comment = AnyToken & {kind: "comment", innerRange?: Range}
export type PI = AnyToken & {kind: "pi", innerRange: Range}

type TagOpen  = AnyToken & {kind: "tag_open", name: string,
                         is_close: boolean, is_option: boolean}
export type TagClose = AnyToken & {
  kind: "tag_close", is_empty_element: boolean,
  lineEndLength: number
}

// Entity
type EntOpen = AnyToken & {kind: "entpath_open", name: string}

export type Token = Text | Comment | PI |
  TagOpen | AttToken | TagClose | EntOpen | EntNode | LCMsgToken

function* splitline(ctx: ParserContext, prefix: Range): Generator<Token> {
  let offset = prefix.start
  for (const line of ctx.range_text(prefix).split(/(?<=\n)/)) {
    // console.log(`at ${ctx.line}: (${line})`)
    let end = offset + line.length;
    yield { kind: "text", start: offset, end, line: ctx.line, lineEndLength: lineEndLength(line) }
    offset = end;
    if (line.charAt(line.length-1) === "\n") {
      ctx.line++
    }
  }
}

function lineEndLength(text: string): number {
  if (text.length < 1
      || text.charAt(text.length - 1) !== '\n') {
    return 0
  }
  // Found \n
  else if (text.length < 2 || text.charAt(text.length - 2) !== '\r') {
    return 1
  }
  // Found \r\n
  else {
    return 2;
  }
}

function tokenTrimming(tok: Payload): number {
  return tok.end - tok.start - tok.data.length
}

export function* tokenize(session: ParserSession, payloadList: Payload[]): Generator<Token,any,any>
  {
  let outerCtx = new ParserContext(session);
  let re = outerCtx.re('body', () => re_body(session.params.namespace))
  for (const tok of payloadList) {
    if (tok.kind === "comment") {
      yield tok
    } else if (tok.kind === "text") {
      let ctx = outerCtx.narrowed(tok, tokenTrimming(tok))
      let globalMatch
      while ((globalMatch = ctx.global_match(re))) {
        const prefix = ctx.prefix_of(globalMatch)
        if (prefix != null) {
          yield* splitline(ctx, prefix)
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
                     , ...ctx.token_range(range, end.index)}
            }
            else {
              const kind = bm.msgsep ? "lcmsg_sep"
                : bm.msgclo ? "lcmsg_close" : null;
              if (kind == null) {
                throw ctx.throw_error("BUG: unknown condition");
              }

              yield { kind, ...ctx.token_range(range, end.index)}
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
          const close = ctx.tab_match(end);
          yield {kind: "tag_close",
                 is_empty_element: end.groups && end.groups.empty_tag != null ? true : false,
                 lineEndLength: lineEndLength(ctx.range_text(close)),
                 ...close}
        }
        else if (bm.pi != null) {
          const range = ctx.tab(globalMatch)
          const end = ctx.match_index(/.*?\?>/sy)
          if (end == null) {
            ctx.throw_error("Missing ?>")
            return; // NOT REACHED
          }
          const endRange = ctx.tab_match(end)
          const innerRange = {start: endRange.start, end: endRange.end-2}
          yield {kind: "pi", innerRange, ...ctx.token_range(range, endRange)}
        }
        else {
          ctx.NEVER()
        }
      }
      
      const rest = ctx.rest_range()
      if (rest != null) {
        yield* splitline(ctx, rest)
      }

    } else {
      // never
    }
  }
}

if (import.meta.main) {
  (async () => {
    const process = await import("node:process")
    const { readFileSync } = await import('node:fs')
    const [_cmd, _script, ...args] = process.argv;
    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0;

    (async () => {
      let config: LrxmlConfig = {
        debug: { parser: debugLevel }
      }

      const { session_range_text } = await import('../context.ts')
      const { parse_multipart } = await import('../multipart/parse.ts')
      const { parse_long_options } = await import("../utils/long-options.ts")
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
            const text = session_range_text(session, tok)
            process.stdout.write(JSON.stringify([tok, text]) + "\n")
          }
        }
        process.stdout.write("\n")
      }

    })()
  })()
}
