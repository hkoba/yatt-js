import { RawPart, AttItem } from 'lrxml-js'
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

  build(ctx: BuilderContext, keyword: string, raw_part: RawPart): Widget {
    let attlist = Object.assign([], raw_part.attlist)
    let name: string
    let route: string|undefined;
    let is_public: boolean
    if (! this.is_named) {
      name = "";
      is_public = true
    } else {
      let head = ctx.cut_name_and_route(attlist)
      if (head == null) {
        ctx.throw_error(`Widget name is not given`)
      }
      [name, route] = head
      is_public = this.is_public
    }
    let arg_dict = ctx.build_arg_dict(attlist)
    // XXX: keyword
    return {type: "widget", name, route, is_public, arg_dict, raw_part}
  }
}

