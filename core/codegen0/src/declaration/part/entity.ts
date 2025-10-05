import {type AttItem, isIdentOnly} from '../../deps.ts'
import type {DeclarationProcessor, BuilderContext} from '../context.ts'
import type {TemplateDeclaration} from '../types.ts'
import type {Entity} from '../part.ts'

export class EntityBuilder implements DeclarationProcessor {
  readonly kind: 'entity' = 'entity';
  constructor() {}

  async process(ctx: BuilderContext, template: TemplateDeclaration, attlist: AttItem[]): Promise<[Entity, AttItem[]]> {
    if (! attlist.length || attlist[0] == null) {
      ctx.throw_error(`Entity name is not given!`)
    }
    const att = attlist.shift()!
    if (! isIdentOnly(att))
      ctx.NIMPL();
    const name = att.value

    if (template.partMap[this.kind].has(name)) {
      ctx.throw_error(`Duplicate ${this.kind} declaration ${name}`);
    }

    const part: Entity = {
      kind: this.kind, name, is_public: false,
      argMap: new Map, varMap: new Map, payloads: []
    }

    template.partMap[this.kind].set(name, part)
    template.partOrder.push([this.kind, name])

    return [part, attlist]
  }
}
