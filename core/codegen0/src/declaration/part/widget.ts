import type {AttItem} from '../../deps.ts'

import type {DeclarationProcessor, BuilderContext} from '../context.ts'

import type {Widget} from '../part.ts'

import {cut_name_and_route} from '../attlist.ts'

export class WidgetBuilder implements DeclarationProcessor {
  readonly kind: string = 'widget'
  constructor(
    readonly is_named: boolean, readonly is_public: boolean,
  ) {}

  createPart(ctx: BuilderContext, attlist: AttItem[], implicit?: boolean): [Widget, AttItem[]] {
    const att = cut_name_and_route(ctx, this.is_named, attlist)
    if (! att) {
      ctx.throw_error(`Widget name is not given!`)
    }

    const {name, nameNode, route} = att
    const widget = makeWidget(name, this.is_public, nameNode, route, implicit)
    // XXX: route params
    return [widget, attlist];
  }
}

export function makeWidget(
  name: string, isPublic: boolean, nameNode?: AttItem
  , route?: string | [string, string]
  , implicit?: boolean
): Widget {
  return {
    kind: "widget", name, nameNode, is_public: isPublic,
    implicit,
    argMap: new Map, varMap: new Map, route, payloads: []
  }
}
