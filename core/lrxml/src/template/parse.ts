#!/usr/bin/env ts-node

import {LrxmlConfig} from '../config'
import type { RangeLine, Range, ParserSession } from '../context'
import { ParserContext } from '../context'

import { tokenize, Token, Text, Comment, PI } from './tokenize'

import { Part } from '../multipart/parse'

import type {
  AttItem, Term, Label, StringTerm,
  AttIdentOnly, AttLabeled, AttLabeledNested, AttLabeledByIdent
  , NestedTerm
} from '../attlist/parse'
import {
  parse_attlist, 
  attKindIsQuotedString,
} from '../attlist/parse'

import { EntNode } from '../entity/parse'

export type Node = BodyNode | AttItem
export type AnonNode = {kind: string} & RangeLine
export {Term}

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

export function parse_template(session: ParserSession, part: Part): BodyNode[] {
  let lex = tokenize(session, part.payload)
  let ctx = new ParserContext(session);
  let nodeList: BodyNode[] = [];
  parse_tokens(ctx, part, lex, 0, nodeList);
  return nodeList;
}

function parse_tokens(
  ctx: ParserContext, part: Part, lex: Generator<Token>,
  depth: number,
  sink: BodyNode[], close?: string, parent?: (ElementNode | AttElement)
): void {

  let cur;
  while (!(cur = lex.next()).done) {
    const tok = cur.value
    ctx.index = tok.start
    if (ctx.debug) {
      process.stdout.write('|' + '  '.repeat(depth) + `${tok.start} - ${tok.kind}\n`)
    }
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
          return
        }
        const [attlist, end] = parse_attlist(ctx, lex, "tag_close");
        if (end.kind !== "tag_close") {
          ctx.NEVER()
        }
        let elem: ElementNode | AttElement = {
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

        if (! end.is_empty_element) {
          // <yatt:tag> or <:yatt:tag>
          let body = elem.children = []
          parse_tokens(ctx, part, lex, depth+1, body, tok.name, elem)
        }
        else if (elem.kind === "attelem") {
          // <:yatt:else/> ...
          sink = elem.children = []
        }

        break;
      }
      default: {
        ctx.NIMPL(tok)
      }
    }
  }
}

function parse_lcmsg(ctx: ParserContext, lex: Generator<Token>)
: {lcmsg: Text[][], bind: EntNode[], end: Range} {
  let sink: Text[] = [];
  let lcmsg = [sink]
  let bind: EntNode[] = []
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
      }
      case "comment": break; // just ignore
      default: {
        ctx.throw_error(`Invalid token: ${tok.kind}`)
      }
    }
  }
  ctx.throw_error(`lcmsg is not terminated!`)
}

if (module.id === ".") {
  (async () => {
    const { readFileSync } = await import('fs')
    const [_cmd, _script, ...args] = process.argv;

    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0;

    (async () => {
      let config: LrxmlConfig = {
        debug: { parser: debugLevel }
      }

      const { parse_long_options } = await import("../utils/long-options")
      parse_long_options(args, {target: config})

      const { parse_multipart } = await import('../multipart/parse')

      for (const fn of args) {
        const source = readFileSync(fn, { encoding: "utf-8" })
        let [partList, session] = parse_multipart(source, {
          filename: fn, ...config
        })
        
        for (const part of partList) {
          console.dir(part, {colors: true, depth: null})
          console.dir(parse_template(session, part), {colors: true, depth: null})
        }
      }
    })()
  })()
}
