import { parse_attstring } from "../../../lrxml/src/attstring/parse.ts";
import { parserContext, RangeLine } from "../../../lrxml/src/context.ts";
import {type AttItem, isBareLabeledAtt, isIdentOnly, hasLabel, hasQuotedStringValue} from '../deps.ts'
import {attInnerRange} from '@yatt/lrxml'

import type { BuilderContext } from './context.ts'

import {type Widget, type Part, makeWidget} from './part.ts'

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
    return { typeName: defaultType }
  } else {
    const typeName = match.index ? str.substring(0, match.index) : defaultType;
    const dflag = match[0]
    const start = range.start + match.index + 1
    const end = range.end
    const defaultValue = str.substring(match.index + 1);
    // XXX: 
    const parserCtx = ctx.parserContext()
    if (ctx.session.params.debug.declaration) {
      console.log(`parse_arg_spec defaultValue "${defaultValue}"`)
      console.log(`<=>`, parserCtx.range_text({start, end}))
    }
    const kids = parse_attstring(parserCtx, {line: range.line, start, end})
    return { typeName, defaultSpec: [dflag as DefaultFlag, defaultValue, kids] }
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
    if (ctx.debug >= 2) {
      console.log('add args from: ', att)
    }
    if (isBareLabeledAtt(att)) {
      //: name = SOMETHING
      const name = att.label.value
      if (att.kind === "bare" || att.kind === "sq" || att.kind === "dq") {
        //: name="type?default"
        if (ctx.debug) {
          console.log(`kind ${att.kind}: ${name} = ${att.value}`)
        }
        const spec = parse_arg_spec(ctx, att.value, "text", attInnerRange(ctx.parserContext(), att))
        const v = build_simple_variable(ctx, name, spec, {
          attItem: att, argNo: part.argMap.size
        })
        part.argMap.set(name, v)
      }
      else if (att.kind === "nest") {
        //: name=[code] name=[delegate]
        if (att.value.length === 0) {
          ctx.token_error(att, `Empty arg declaration`)
        }
        const attlist = ctx.copy_array(att.value)
        //: attlist is [code x y z], [delegate x y z], [delegate:foo x y]
        const fst = attlist.shift()!
        //: fst is code, delegate (or "code", "delegate")
        if (isIdentOnly(fst)
            || !hasLabel(fst) && hasQuotedStringValue(fst)) {
          const [givenTypeName, ...restName] = fst.value.split(/:/)

          const rec = ctx.session.varTypeMap.nested.get(givenTypeName)
          if (rec == null) {
            ctx.token_error(fst, `Unknown type ${givenTypeName} for argument ${name}`)
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
        }
        else {
          ctx.token_error(fst, `Unknown arg declaration`)
        }
      }
      else {
        ctx.token_error(att, `Unknown arg declaration`)
      }
    }
    else if (isIdentOnly(att)) {
      //: nameOnly
      const name = att.value
      const v = build_simple_variable(ctx, name, {typeName: "text"}, {
        attItem: att, argNo: part.argMap.size
      })
      part.argMap.set(name, v)
    }
    else if (att.kind === "entity") {
      // XXX: entity (ArgMacro)
      console.warn(`Ignoring argmacro`)
    }
    else {
      ctx.token_error(att, `Unknown arg declaration`)
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
