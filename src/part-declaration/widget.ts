import { RawPart } from 'lrxml-js'
import { Part } from './part'
import { DeclarationBuilder, BuilderContext } from './context'

export type Widget = Part & {
    type: "widget"
    route?: string
}

export class WidgetBuilder implements DeclarationBuilder {
    constructor(readonly is_named: boolean, readonly is_public: boolean) {}

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
