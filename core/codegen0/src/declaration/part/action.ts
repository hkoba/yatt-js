import type {AttItem} from '../../deps.ts'
import type {DeclarationProcessor, BuilderContext} from '../context.ts'
import type {TemplateDeclaration} from '../types.ts'
import type {Action} from '../part.ts'

import {cut_name_and_route} from '../attlist.ts'

export class ActionBuilder implements DeclarationProcessor {
  readonly kind: 'action' = 'action';
  constructor() {}

  async process(ctx: BuilderContext, template: TemplateDeclaration, attlist: AttItem[]): Promise<[Action, AttItem[]]> {
    if (! attlist.length || attlist[0] == null) {
      ctx.throw_error(`Action name is not given`)
    }
    const att = cut_name_and_route(ctx, true, attlist)
    if (! att) {
      ctx.throw_error(`Action name is not given!`)
    }
    const {name, route} = att

    if (template.partMap[this.kind].has(name)) {
      ctx.throw_error(`Duplicate ${this.kind} declaration ${name}`);
    }

    const part: Action = {kind: this.kind, name, route, is_public: true,
             argMap: new Map, varMap: new Map, payloads: []}

    template.partMap[this.kind].set(name, part)
    template.partOrder.push([this.kind, name])

    return [part, attlist]
  }
}
