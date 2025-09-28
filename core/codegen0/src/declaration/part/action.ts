import type {AttItem} from '../../deps.ts'

import type {DeclarationProcessor, BuilderContext} from '../context.ts'

import type {Action} from '../part.ts'

import {cut_name_and_route} from '../attlist.ts'

export class ActionBuilder implements DeclarationProcessor {
  readonly kind = 'action';
  constructor() {}

  createPart(ctx: BuilderContext, attlist: AttItem[]): [Action, AttItem[]] {
    if (! attlist.length || attlist[0] == null) {
      ctx.throw_error(`Action name is not given`)
    }
    const att = cut_name_and_route(ctx, true, attlist)
    if (! att) {
      ctx.throw_error(`Action name is not given!`)
    }
    const {name, route} = att
    return [{kind: this.kind, name, route, is_public: true,
             argMap: new Map, varMap: new Map, payloads: []}, attlist]
  }
}
