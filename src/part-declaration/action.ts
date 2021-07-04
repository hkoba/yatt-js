import { RawPart, AttItem } from 'lrxml-js'
import { Part } from './part'
import { DeclarationBuilder, BuilderContext, PartName } from './context'

export type Action = Part & {
  type: "action"
  route?: string
}

export class ActionBuilder implements DeclarationBuilder {

  parse_part_name(ctx: BuilderContext, attlist: AttItem[]): PartName {
    if (! attlist.length || attlist[0] == null) {
      ctx.throw_error(`Action name is not given`)
    }
    const [name, route] = ctx.cut_name_and_route(attlist)!
    return {name, route, rest: attlist}
  }

  build(ctx: BuilderContext, keyword: string, raw_part: RawPart): Action {
    let attlist = Object.assign([], raw_part.attlist)
    let head = ctx.cut_name_and_route(attlist)
    if (head == null) {
      ctx.throw_error(`Action name is not given`)
    }
    let [name, route] = head
    let arg_dict = ctx.build_arg_dict(attlist)
    return {type: "action", name, route, arg_dict,
            is_public: true, raw_part}
  }
}
