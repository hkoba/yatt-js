import {type AttItem, attShape} from '../deps.ts'

import type {BuilderContext} from './context.ts'

import type {
  RouteMapType, RouteSpec, Part
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
    if (attlist.length) {
      const s = attShape(attlist[0])
      if (s.shape === "positional" && s.value.shape === "string" && s.value.quoted) {
        const att = attlist.shift()!
        routeSpec = {
          pattern: s.value.text, method: [],
          nameNode: att
        };
      }
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
      const lowerMethod = s.name.toLowerCase()
      if (! ctx.session.allowedRouteMethodSet.has(lowerMethod)) {
        ctx.token_error(head, `Unsupported http method: ${lowerMethod}`)
      }
      method.push(lowerMethod)
    }
    else if (s.shape === "positional" && s.value.shape === "string" && s.value.quoted) {
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
  ctx: BuilderContext, routeMap: RouteMapType
  , routeSpec: RouteSpec, part: Part
): void {

  // XXX: path-ro-regexp and add args to part

  let entry = routeMap.get(routeSpec.pattern)
  if (! entry) {
    entry = {pattern: routeSpec.pattern, byMethod: new Map};
    routeMap.set(routeSpec.pattern, entry)
  }
  for (const method of routeSpec.method.length ? routeSpec.method : ["*"]) {
    const found = entry.byMethod.get(method)
    if (found) {
      ctx.token_error(routeSpec.nameNode, `route conflict: ${method} ${entry.pattern} (already claimed by ${found.part.name})`)
    }
    entry.byMethod.set(method, {part, nameNode: routeSpec.nameNode})
  }
}

function location2name(routeSpec: RouteSpec): string {
  const {pattern, method} = routeSpec;
  let name = pattern.replace(
    /[^A-Za-z0-9]/g,
    (s) => '_' + s.charCodeAt(0).toString(16));
  if (method.length) {
    name += '__' + [...method].sort().join("_")
  }
  return name

}
