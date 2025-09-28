#!/usr/bin/env -S deno run -RE

import type {LrxmlConfig} from '../config.ts'
import type { RangeLine, Range, ParserSession, ParserBaseSession } from '../context.ts'
import { ParserContext } from '../context.ts'

import { tokenize, type Token, type Text, type Comment, type PI, type TagClose } from './tokenize.ts'

import type { Payload } from '../multipart/parse.ts'

import type {
  AttItem, Term, Label, StringTerm,
  AttIdentOnly, AttLabeled, AttLabeledNested, AttLabeledByIdent
  , NestedTerm
} from '../attlist/parse.ts'
import {
  parse_attlist, 
  attKindIsQuotedString,
} from '../attlist/parse.ts'

import type { EntNode } from '../entity/parse.ts'

export type Node = BodyNode | AttItem
export type AnonNode = {kind: string} & RangeLine
export type {Term}

// export function anonNode<T extends Node>(node: T): AnonNode {
//   const {kind, start, end} = node
//   return {kind, start, end}
// }

type ElementBody = RangeLine & {
  path: string[]
  attlist: (AttItem | AttElement)[]
  children?: BodyNode[]
  footer?: AttElement[]
  // containedRange
}

export type ElementNode = {kind: "element"} & ElementBody;
export type AttElement = {kind: "attelem"} & ElementBody;

export type LCMsg   = RangeLine & {kind: "lcmsg", namespace: string[]
                               , lcmsg: Text[][], bind: EntNode[]}

export type BodyNode = Text | Comment | PI | ElementNode | AttElement | EntNode | LCMsg

export function hasStringValue(att: AttItem | AttElement)
: att is ({label?: Label} & StringTerm) {
  return att.kind === "bare" || att.kind === "sq" || att.kind === "dq" ||
    (att.kind === "identplus" && att.label == null)
}

export function hasQuotedStringValue(att: AttItem | AttElement)
: att is ({label?: Label} & StringTerm) {
  return attKindIsQuotedString(att.kind);
}

export function isIdentOnly(att: AttItem | AttElement)
: att is AttIdentOnly {
  return !hasLabel(att) && att.kind === 'identplus'
}

export function hasNestedTerm(att: AttItem | AttElement)
: att is NestedTerm {
  return att.kind === 'nest'
}

export function hasNestedLabel(att: AttItem | AttElement)
: att is AttLabeledNested {
  return hasLabel(att) && att.label.kind === 'nest'
}

export function hasLabel(att: AttItem | AttElement): att is AttLabeled {
  return (att as AttItem).label !== undefined
}

export function isBareLabeledAtt(att: AttItem | AttElement): att is AttLabeledByIdent {
  return hasLabel(att) && att.label.kind === 'identplus'
}

export function maybeArgName(att: AttItem | AttElement)
: [string, boolean] | undefined {
  if (hasLabel(att)) {
    if (att.label.kind !== 'identplus') return;
    return [att.label.value, att.label.has_three_colon]
  } else {
    if (att.kind !== 'identplus') return;
    return [att.value, false]
  }
}

export function maybePassThruVarName(att: AttItem | AttElement)
: string | undefined {
  if (att.kind !== 'identplus' || att.has_three_colon) {
    return
  }
  return att.value
}

function ensure_session_has_patterns(session: ParserSession | ParserBaseSession)
: ParserSession {
  if ((session as ParserSession).patterns != null) {
    return session as ParserSession
  } else {
    return {patterns: {}, ...session}
  }
}

export function parse_template(session: ParserSession | ParserBaseSession, payload: Payload[]): BodyNode[] {

  const session__ = ensure_session_has_patterns(session)

  const lex = tokenize(session__, payload)
  const ctx = new ParserContext(session__);
  const nodeList: BodyNode[] = [];
  parse_tokens(ctx, lex, 0, nodeList);
  return nodeList;
}

function parse_tokens(
  ctx: ParserContext, lex: Generator<Token>,
  depth: number,
  sink: BodyNode[], close?: string, parent?: (ElementNode | AttElement)
): TagClose | undefined {

  let cur;
  let is_closed;
  let lastTok: TagClose | undefined
  while (!(cur = lex.next()).done) {
    const tok = cur.value
    ctx.index = tok.start
    // if (ctx.debug) {
    //   process.stdout.write('|' + '  '.repeat(depth) + `${tok.start} - ${tok.kind}\n`)
    // }
    switch (tok.kind) {
      case "text": case "comment": case "pi": {
        sink.push(tok)
        break;
      }
      case "entpath_open": break;
      case "entity": {
        sink.push(tok)
        break;
      }
      case "lcmsg_open": {
        const {lcmsg, bind, end} = parse_lcmsg(ctx, lex)
        sink.push({kind: "lcmsg", namespace: tok.namespace, lcmsg, bind,
                   ...ctx.token_range(tok, end)})
        break;
      }
      case "tag_open": {
        if (tok.is_close) {
          if (close == null) {
            ctx.throw_error(`close tag without open: ${tok.name}`)
          }
          if (tok.name !== close) {
            ctx.throw_error(`tag mismatch! EXPECT ${close}, GOT ${tok.name} at index=${ctx.index}`)
          }
          const nx = lex.next().value
          if (!nx || nx.kind !== 'tag_close')
            ctx.throw_error(`tag is not closed by '>'`)

          lastTok = nx
          is_closed = true
          break;
        }
        const [attlist, end] = parse_attlist(ctx, lex, "tag_close");
        if (end.kind !== "tag_close") {
          ctx.NEVER()
        }
        const elem: ElementNode | AttElement = {
          kind: tok.is_option ? "attelem" : "element",
          path: tok.name.split(/:/), attlist,
          ...ctx.token_range(tok)
        }

        if (elem.kind === "element") {
          // <yatt:tag> or <yatt:tag/>
          sink.push(elem)
        }
        else if (! parent) {
          ctx.throw_error(`BUG: parent is empty!`)
        }
        else if (end.is_empty_element) {
          // <:yatt:tag/>
          parent.footer ??= []
          parent.footer.push(elem)
        }
        else {
          // <:yatt:tag>
          parent.attlist.push(elem)
        }

        if (tok.is_option && ! end.is_empty_element) {
          // console.log(`may drop_leading_ws?`, tok, end, sink)
          drop_leading_ws(ctx, sink)
          // console.log(` =>`, sink)
        }

        if (! end.is_empty_element) {
          // <yatt:tag> or <:yatt:tag>
          const body: BodyNode[] = elem.children = []
          if (end.lineEndLength) {
            body.push(lineEndNode(end))
          }
          const closeTok = parse_tokens(ctx, lex, depth+1, body, tok.name, elem)
          if (closeTok != null && closeTok.lineEndLength) {
            sink.push(lineEndNode(closeTok))
          }
        }
        else {
          if (elem.kind === "attelem") {
            // <:yatt:else/> ...
            sink = elem.children = []
          }
          if (end.lineEndLength) {
            sink.push(lineEndNode(end))
          }
        }

        break;
      }
      default: {
        ctx.NIMPL(tok)
      }
    }

    if (is_closed) {
      break;
    }
  }

  if (close && ! is_closed) {
    ctx.throw_error(`Missing close tag ${close}`)
  }

  return lastTok
}

function drop_leading_ws(ctx: ParserContext, sink: BodyNode[]): void {
  while (sink.length) {
    const last = sink[sink.length-1]
    if (/^\s*$/.test(ctx.range_text(last))) {
      sink.pop()
    }
  }
}

function lineEndNode(end: TagClose): BodyNode {
  return {
    kind: "text", lineEndLength: end.lineEndLength,
    line: end.line,
    start: end.end - end.lineEndLength,
    end: end.end
  }
}

function parse_lcmsg(ctx: ParserContext, lex: Generator<Token>)
: {lcmsg: Text[][], bind: EntNode[], end: Range} {
  let sink: Text[] = [];
  const lcmsg = [sink]
  const bind: EntNode[] = []
  for (const tok of lex) {
    ctx.index = tok.start
    switch (tok.kind) {
      case "text": {
        sink.push(tok)
        break;
      }
      case "entpath_open": break;
      case "entity": {
        bind.push(tok)
        break;
      }
      case "lcmsg_close": {
        return {lcmsg, bind, end: {start: tok.start, end: tok.end}}
      }
      case "lcmsg_sep": {
        lcmsg.push(sink = [])
        break;
      }
      case "comment": break; // just ignore
      default: {
        ctx.throw_error(`Invalid token: ${tok.kind}`)
      }
    }
  }
  ctx.throw_error(`lcmsg is not terminated!`)
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

      const { parse_long_options } = await import("../utils/long-options.ts")
      parse_long_options(args, {target: config})

      const { parse_multipart } = await import('../multipart/parse.ts')

      for (const fn of args) {
        const source = readFileSync(fn, { encoding: "utf-8" })
        let [contentList, session] = parse_multipart(source, {
          filename: fn, ...config
        })
        
        for (const content of contentList) {
          console.dir(content, {colors: true, depth: null})
          if (content.kind === 'boundary')
            continue
          console.dir(parse_template(session, [content]), {colors: true, depth: null})
        }
      }
    })()
  })()
}
