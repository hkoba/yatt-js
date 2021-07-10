import { AttItem } from 'lrxml-js'
import { Part } from './part'
import { DeclarationBuilder, BuilderContext, PartName } from './context'

export type Action = Part & {
  type: "action"
  route?: string
}

export class ActionBuilder implements DeclarationBuilder {
  readonly kind = 'action';
  constructor(readonly prefix: string = 'do_') {}

  parse_part_name(ctx: BuilderContext, attlist: AttItem[]): PartName {
    if (! attlist.length || attlist[0] == null) {
      ctx.throw_error(`Action name is not given`)
    }
    const [name, route] = ctx.cut_name_and_route(attlist)!
    return {kind: this.kind, prefix: this.prefix, name, route, rest: attlist}
  }
}
