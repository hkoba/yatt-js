import {type AttItem, hasQuotedStringValue, hasLabel
  , hasStringValue, hasNestedTerm, hasNestedLabel
  , isIdentOnly
} from '../deps.ts'

import {BuilderContext} from './context.ts'

import {type RouteMapType, type Part} from './types.ts'

export function cut_name_and_route(
  ctx: BuilderContext,
  is_named: boolean,
  attlist: AttItem[]
)
: {name: string, route?: string | [HTTP_METHOD, string], nameNode?: AttItem} | undefined
{
  let name, method, routeStr, nameNode
  if (! is_named) {
    name = ""
    if (attlist.length && !hasLabel(attlist[0])
      && hasQuotedStringValue(attlist[0])) {
      routeStr = ctx.range_text(attlist.shift()!);
    }

  } else {
    if (!attlist.length)
      return
    const head = attlist.shift()
    if (head == null)
      return
    nameNode = head
    if (hasLabel(head)) {
      // name="value", [..]="..", [..]=[..]
      if (hasNestedLabel(head)) {
        // [..]=..
        ctx.NIMPL(head);
      }
      name = head.label.value
      if (hasStringValue(head)) {
        // ..=".."
        routeStr = head.value
      }
      else if (hasNestedTerm(head)) {
        // ..=[..]
        [method, routeStr] = parse_method_and_route(ctx, head, head.value)
      }
      else {
        ctx.NIMPL(head)
      }
    }
    else if (isIdentOnly(head)) {
      // name
      name = head.value
    }
    else {
      // "...", [...], %entity;
      if (head.kind === "entity") {
        // %entity;
        ctx.NIMPL(head)
      }
      if (hasQuotedStringValue(head)) {
        // "..."
        routeStr = head.value
      }
      else if (hasNestedTerm(head)) {
        [method, routeStr] = parse_method_and_route(ctx, head, head.value)
      }
      else {
        // ???
        ctx.NEVER(head)
      }
      name = location2name(routeStr)
    }
  }

  if (routeStr && routeStr.charAt(0) !== "/") {
    ctx.maybe_token_error(nameNode, `route doesn\'t start with '/'!: ${routeStr}`)
  }

  // XXX: Is this packing of [HTTP_METHOD, string] useful?
  const route: string | [HTTP_METHOD, string] | undefined
    = routeStr == null ? undefined
    : method == null ? routeStr
    : [method, routeStr]

  return {name, route, nameNode}
}

export type HTTP_METHOD = 'get' | 'post'

function parse_method_and_route(ctx: BuilderContext, head: AttItem, attlist: AttItem[]): [HTTP_METHOD, string] {

  let method, routeStr

  if (attlist.length === 2) {
    const [m, r] = attlist
    if (! hasStringValue(m)) {
      ctx.token_error(head, `Unsupported route spec: ${JSON.stringify(m)}`)
    }
    if (! hasStringValue(r)) {
      ctx.token_error(head, `Unsupported route spec: ${JSON.stringify(r)}`)
    }

    [method, routeStr] = [m.value.toLowerCase(), r.value]
  }
  else if (attlist.length === 1 && hasLabel(attlist[0])) {
    const att = attlist[0]
    if (! (isIdentOnly(att.label) && hasStringValue(att))) {
      ctx.token_error(head, `Unsupported route spec: ${JSON.stringify(att)}`)
    }
    [method, routeStr] = [att.label.value.toLowerCase(), att.value]
  }
  else {
    ctx.token_error(head, `Unsupported route spec: ${JSON.stringify(attlist)}`)
  }

  if (! (method === 'get' || method === 'post')) {
    ctx.token_error(head, `Unsupported http method: ${method}`)
  }
  return [method, routeStr]
}

export function add_route(
  _ctx: BuilderContext, routeMap: RouteMapType
  , routeSpec: string | [string, string], part: Part
): void {
  // XXX: path-ro-regexp and add args to part
  const [method, route] = typeof routeSpec === 'string' ?
    [undefined, routeSpec] : routeSpec

  routeMap.set(route, {part, method});
}

function location2name(loc: string): string {
  return loc.replace(
    /[^A-Za-z0-9]/g,
    (s) => '_' + s.charCodeAt(0).toString(16)
  )
}
