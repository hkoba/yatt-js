import { parse_attstring } from "../../../lrxml/src/attstring/parse.ts";
import type { RangeLine } from "../../../lrxml/src/context.ts";
import {
  type AttItem,
  attShape, type AttShape
} from '../deps.ts'
import {attInnerRange} from '@yatt/lrxml'

import type { BuilderContext } from './context.ts'

import type {Widget, Part} from './part.ts'

import {makeWidget} from './part/widget.ts'

import {
  type Variable, build_simple_variable
  , type VarTypeSpec, type DefaultFlag
} from './vartype.ts'

export type ArgAdder = {
  name: string, dep: string, fun: (widget: Widget) => ArgAdder | undefined
}

export function parse_arg_spec(
  ctx: BuilderContext, str: string, defaultType: string,
  range: RangeLine
): VarTypeSpec {
  // XXX: typescript type extension
  const match = /([\/\|\?!])/.exec(str)
  if (match == null) {
    const tn = str.trim()
    return { typeName: tn.length > 0 ? tn : defaultType }
  } else {
    const typeName = match.index ? str.substring(0, match.index) : defaultType;
    const dflag = match[0] as DefaultFlag
    const start = range.start + match.index + 1
    const end = range.end
    const defaultValue = str.substring(match.index + 1);
    // XXX: 
    const parserCtx = ctx.parserContext()
    if (ctx.session.params.debug.declaration) {
      console.log(`parse_arg_spec defaultValue "${defaultValue}"`)
      console.log(`<=>`, parserCtx.range_text({start, end}))
    }
    const children = parse_attstring(parserCtx, {line: range.line, start, end})
    return { typeName, defaultSpec: {dflag, text: defaultValue, children} }
  }
}

export function add_args(
  ctx: BuilderContext, part: Part, attlist: AttItem[]
): ArgAdder | undefined {

  const gen = (function* () {
    for (const v of attlist) {
      yield v
    }
  })();
  
  return add_args_cont(ctx, part, gen)
}

export function add_args_cont(
  ctx: BuilderContext, part: Part, gen: Generator<AttItem>
): ArgAdder | undefined {

  for (const att of gen) {
    if (ctx.debug >= 3) {
      console.log('add args from: ', att)
    }
    const s = attShape(att)
    switch (s.shape) {
      case "identOnly": {
        //: nameOnly
        if (s.has_three_colon) {
          ctx.token_error(att, `Syntax error: :::${s.name}`)
        }
        const name = s.name
        const v = build_simple_variable(ctx, name, {typeName: "text"}, {
          attItem: att, argNo: part.argMap.size
        })
        part.argMap.set(name, v)
        break
      }

      case "labeled": {
        //: name = SOMETHING
        const name = s.name;
        switch (s.value.shape) {
          case "string":
          case "ident": {
            //: name="type?default" name=type
            if (ctx.debug) {
              console.log(`kind ${att.kind}: ${name} = ${s.value.text}`)
            }
            const spec = parse_arg_spec(ctx, s.value.text, "text", attInnerRange(ctx.parserContext(), att))
            const v = build_simple_variable(ctx, name, spec, {
              attItem: att, argNo: part.argMap.size
            })
            part.argMap.set(name, v)
            break;
          }
          case "nest": {
            //: name=[code] name=[delegate]
            if (s.value.items.length === 0) {
              ctx.token_error(att, `Empty arg declaration`)
            }
            const attlist = [...s.value.items]
            //: attlist is [code x y z], [delegate x y z], [delegate:foo x y]
            const fst = attShape(attlist.shift()!)
            //: fst is code, delegate (or "code", "delegate")
            const path = getAttString(fst)
            if (! path) {
              ctx.token_error(fst.node, `typename is required`);
            }

            const [givenTypeName, ...restName] = path.split(/:/)

            const rec = ctx.session.varTypeMap.nested.get(givenTypeName)
            if (rec == null) {
              ctx.token_error(fst.node, `Unknown type ${givenTypeName} for argument ${name}`)
            }
            if (rec.kind === "callable") {
              //: name=[code]
              const v = rec.fun(ctx, att, part.argMap.size, name, attlist);
              part.argMap.set(name, v)
            }
            else if (rec.kind === "delayed") {
              //: name=[delegate]
              return rec.fun(
                ctx, part, gen, att, part.argMap.size,
                name, restName, attlist
              )
            }
            else {
              ctx.NEVER();
            }

            break;
          }
          case "entity": {
            //: name=%entity;
            ctx.NIMPL(att)
          }
        }
        break;
      }
      case "positional": {
        //: ".." %entity;
        if (s.value.shape === "entity") {
          // XXX: entity (ArgMacro)
          console.warn(`Ignoring argmacro`)
        }
        else {
          ctx.token_error(att, `Unknown arg declaration`)
        }
        break
      }
      case "attelem":
      case "nestLabeled": {
        //: [..]=..
        ctx.token_error(att, `Unknown arg declaration`)
      }
    }
  }

  if (part.kind === "widget") {
    const BODY_NAME = ctx.body_argument_name()
    if (!part.argMap.has(BODY_NAME)) {
      const bodyVar: Variable = {
        typeName: 'widget', is_escaped: true, is_callable: true,
        varName: BODY_NAME, widget: makeWidget(`(${BODY_NAME})`, false),
        from_route: false, is_body_argument: true
      }
      part.argMap.set(BODY_NAME, bodyVar)
    }
  }

}

function getAttString(shape: AttShape)
: string | undefined
{
  if (shape.shape === "identOnly") {
    return shape.name;
  }
  else if (shape.shape === "positional" && shape.value.shape === "string") {
    return shape.value.text
  }
}
