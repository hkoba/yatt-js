import { AttItem } from 'lrxml-js'
import { Part } from './part'
import { DeclarationBuilder, BuilderContext, PartName } from './context'

export type Widget = Part & {
  type: "widget"
  route?: string
}

export class WidgetBuilder implements DeclarationBuilder {
  constructor(readonly is_named: boolean, readonly is_public: boolean) {}

  parse_part_name(ctx: BuilderContext, attlist: AttItem[]): PartName {
    if (! this.is_named) {
      // yatt:args
      // "/route"
      if (attlist.length && attlist[0] != null && !ctx.att_has_label(attlist[0])
          && ctx.att_is_quoted(attlist[0])) {
        const att = attlist.shift()!
        return {route: ctx.range_text(att), rest: attlist}
      } else {
        return {rest: attlist}
      }
    } else {
      if (! attlist.length) {
        // XXX: token position
        ctx.throw_error(`Widget name is not given`)
      }
      const [name, route] = ctx.cut_name_and_route(attlist)!
      return {name, route, rest: attlist}
    }
  }
}

