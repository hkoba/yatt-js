#!/usr/bin/env ts-node

import {Part as RawPart, ParserContext, Node, AttItem} from 'lrxml-js'

export type DefaultFlag = "?" | "|" | "/"

export type VarDecl = {
    name: string
    type: string
    default?: [DefaultFlag, string]
}

export type ArgDict = {[k: string]: VarDecl}

export type Part = {
    name: string
    is_public: boolean
    arg_dict: ArgDict
}

export type Widget = Part & {
    type: "widget"
    route?: string
    tree: Node[]
}

export type Action = Part & {
    type: "action"
    route?: string
    data: string
}

export type Entity = Part & {
    type: "entity"
    data: string
}

interface DeclarationBuilder {
    build(ctx: ParserContext, keyword: string, part: RawPart): Part;
}

class WidgetBuilder implements DeclarationBuilder {
    constructor(readonly is_named: boolean, readonly is_public: boolean) {}

    build(ctx: ParserContext, keyword: string, part: RawPart): Widget {
        let attlist = Object.assign([], part.attlist)
        let name: string
        let route: string|undefined;
        let is_public: boolean
        if (! this.is_named) {
            name = "";
            is_public = true
        } else {
            let head = cut_name_and_route(ctx, attlist)
            if (head == null) {
                ctx.throw_error(`Widget name is not given`)
            }
            [name, route] = head
            is_public = this.is_public
        }
        let arg_dict = build_arg_dict(ctx, attlist)
        // XXX: keyword
        return {type: "widget", name, route, is_public, arg_dict, tree: []}
    }
}


class ActionBuilder implements DeclarationBuilder {
    build(ctx: ParserContext, keyword: string, part: RawPart): Action {
        let attlist = Object.assign([], part.attlist)
        let head = cut_name_and_route(ctx, attlist)
        if (head == null) {
            ctx.throw_error(`Action name is not given`)
        }
        let [name, route] = head
        let arg_dict = build_arg_dict(ctx, attlist)

        return {type: "action", name, route, arg_dict,
                is_public: true, data: ""}
    }
}

export let builderDict: {[k: string]: DeclarationBuilder} = {
    args: new WidgetBuilder(false, true),
    widget: new WidgetBuilder(true, false),
    page: new WidgetBuilder(true, true),
    action: new ActionBuilder(),
}

function build_arg_dict(ctx: ParserContext, attlist: AttItem[]): ArgDict {
    let arg_dict: ArgDict = {}
    for (const att of attlist) {
        if (att.label) {
            if (att.label.kind !== "bare")
                ctx.throw_error(`Invalid att label: ${att.label}`)
            let name = att.label.value
            if (att.kind === "sq" || att.kind === "dq" || att.kind === "bare") {
                arg_dict[name] = {
                    name, 
                    ...parse_arg_spec(ctx, att.value)
                }
            } else {
                ctx.throw_error(`?? ${att}`)
            }
        }
        else {
            if (att.kind === "bare") {
                let name = att.value
                arg_dict[name] = {name, type: ""}
            } else {
                ctx.throw_error(`?? ${att}`)
            }
        }

    }
    return arg_dict
}

function parse_arg_spec(ctx: ParserContext, str: string)
: {type: string, default?: [DefaultFlag, string]} {
    let match = /([\/\|\?])/.exec(str)
    if (match == null) {
        return {type: ""}
    } else {
        let type = str.substring(0, match.index)
        let dflag = match[0]
        let defaultValue = str.substring(match.index+1);
        return {type, default: [dflag as DefaultFlag, defaultValue]}
    }
}

function cut_name_and_route(
    ctx: ParserContext, attlist: AttItem[]
): [string, string | undefined] | null {
    if (! attlist.length)
        return null
    let head = attlist.shift()
    if (head == null)
        return null
    if (head.label) {
        if (head.label.kind !== "bare") {
            ctx.throw_error(`Invalid token : ${head.label}`)
        }
        if (head.kind === "sq" || head.kind === "dq" || head.kind === "bare") {
            return [head.label.value, head.value]
        } else {
            ctx.NIMPL()
        }
    } else {
        if (head.kind === "sq" || head.kind === "dq") {
            return ["", head.value]
        }
        if (head.kind !== "bare") {
            ctx.NIMPL()
        }
        return [head.value, undefined]
    }
}

