import {type AttItem, hasQuotedStringValue, hasLabel
  , attShape
} from '../deps.ts'

import type {BuilderContext} from './context.ts'

import type {
  RouteMapType, RoutePatternEntry, RouteSpec, Part
} from './types.ts'

export function cut_name_and_route(
  ctx: BuilderContext,
  is_named: boolean,
  attlist: AttItem[]
)
: {name: string, route?: RouteSpec, nameNode?: AttItem} | undefined
{
  let name, nameNode
  let routeSpec: RouteSpec | undefined
  if (! is_named) {
    name = ""
    if (attlist.length && !hasLabel(attlist[0])
      && hasQuotedStringValue(attlist[0])) {
      routeSpec = {
        pattern: ctx.range_text(attlist.shift()!), method: [],
        nameNode: attlist[0]
      };
    }

  } else {
    if (!attlist.length)
      return
    const head = attlist.shift()
    if (head == null)
      return
    nameNode = head
    const nameShape = attShape(nameNode)
    switch (nameShape.shape) {
      case "identOnly": {
        // name
        name = nameShape.name;
        break
      }
      case "labeled": {
        // name=".." name=[..] name=%entity;
        name = nameShape.name
        switch (nameShape.value.shape) {
          case "string": {
            routeSpec = {pattern: nameShape.value.text, method: [], nameNode: head}
            break
          }
          case "nest": {
            routeSpec = parse_method_and_route(ctx, head, nameShape.value.items)
            break;
          }
          case "ident": {
            ctx.token_error(head, `Unsupported route spec: ${JSON.stringify(head)}`)
            break
          }
          case "entity": {
            ctx.NIMPL(head)
          }
        }
        break;
      }
      case "positional": {
        // ".." [...] %entity;
        switch (nameShape.value.shape) {
          case "string": {
            routeSpec = {pattern: nameShape.value.text, method: [], nameNode: head}
            break
          }
          case "nest": {
            routeSpec = parse_method_and_route(ctx, head, nameShape.value.items)
            break;
          }
          case "entity": {
            ctx.NIMPL(head)
          }
        }
        name = location2name(routeSpec)
        break;
      }
      case "nestLabeled": {
        // [..]=".." [..]=[..]
        ctx.NIMPL(head)
        break;
      }
      case "attelem": {
        // ERROR
        ctx.NEVER(head)
      }
    }
  }

  if (routeSpec && routeSpec.pattern.charAt(0) !== "/") {
    ctx.maybe_token_error(nameNode, `route doesn\'t start with '/'!: ${routeSpec.pattern}`)
  }

  return {name, route: routeSpec, nameNode}
}

function parse_method_and_route(ctx: BuilderContext, head: AttItem, attlist: AttItem[]): RouteSpec {

  let routeStr;
  const method = []

  for (const att of attlist) {
    const s = attShape(att)
    if (s.shape === "identOnly") {
      if (s.has_three_colon) {
        ctx.token_error(head, `Syntax error: :::${s.name}`)
      }
      if (! ctx.session.allowedRouteMethodSet.has(s.name)) {
        ctx.token_error(head, `Unsupported http method: ${s.name}`)
      }
      method.push(s.name)
    }
    else if (s.shape === "positional" && s.value.shape === "string") {
      if (routeStr != null) {
        ctx.token_error(head, `Multiple route patterns: ${routeStr} vs ${JSON.stringify(s.node)}`)
      }
      routeStr = s.value.text
    }
    else {
      ctx.token_error(head, `Invalid route spec: ${JSON.stringify(att)}`)
    }
  }

  if (routeStr == null) {
    ctx.token_error(head, `Route pattern is not specified`)
  }

  return {pattern: routeStr, method, nameNode: head}
}

export function add_route(
  _ctx: BuilderContext, routeMap: RouteMapType
  , routeSpec: RouteSpec, part: Part
): void {

  // XXX: path-ro-regexp and add args to part

  const entry: RoutePatternEntry = {pattern: routeSpec.pattern, byMethod: new Map};
  routeMap.set(routeSpec.pattern, entry)
  if (routeSpec.method.length) {
    for (const method of routeSpec.method) {
      entry.byMethod.set(method, {part, nameNode: routeSpec.nameNode})
    }
  } else {
    entry.byMethod.set("*", {part, nameNode: routeSpec.nameNode})
  }

  // routeMap.set(route, {part, method});
}

function location2name(routeSpec: RouteSpec): string {
  const {pattern, method} = routeSpec;
  let name = pattern.replace(
    /[^A-Za-z0-9]/g,
    (s) => '_' + s.charCodeAt(0).toString(16)) + '__';
  if (method.length) {
    name += [...method].sort().join("_")
  }
  return name

}
