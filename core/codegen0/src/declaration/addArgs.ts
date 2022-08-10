import {AttItem, isBareLabeledAtt, isIdentOnly, hasLabel, hasQuotedStringValue} from 'lrxml'

import { BuilderContext, ArgAdder } from './context'

import {Part, makeWidget} from './part'

import {parse_arg_spec} from './createPart'

import {Variable, build_simple_variable} from './vartype'

export function add_args(
  ctx: BuilderContext, part: Part, attlist: AttItem[]
): ArgAdder | undefined {

  let gen = (function* () {
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
      let name = att.label.value
      if (att.kind === "bare" || att.kind === "sq" || att.kind === "dq"
          || att.kind === "identplus") {
        //: name="type?default"
        if (ctx.debug) {
          console.log(`kind ${att.kind}: ${name} = ${att.value}`)
        }
        let spec = parse_arg_spec(ctx, att.value, "text")
        let v = build_simple_variable(ctx, name, spec, {
          attItem: att, argNo: part.argMap.size
        })
        part.argMap.set(name, v)
      }
      else if (att.kind === "nest") {
        //: name=[code] name=[delegate]
        if (att.value.length === 0) {
          ctx.token_error(att, `Empty arg declaration`)
        }
        let attlist = ctx.copy_array(att.value)
        //: attlist is [code x y z], [delegate x y z], [delegate:foo x y]
        let fst = attlist.shift()!
        //: fst is code, delegate (or "code", "delegate")
        if (isIdentOnly(fst)
            || !hasLabel(fst) && hasQuotedStringValue(fst)) {
          let [givenTypeName, ...restName] = fst.value.split(/:/)

          const rec = ctx.session.varTypeMap.nested.get(givenTypeName)
          if (rec == null) {
            ctx.token_error(fst, `Unknown type ${givenTypeName} for argument ${name}`)
          }
          if (rec.kind === "callable") {
            //: name=[code]
            let v = rec.fun(ctx, att, part.argMap.size, name, attlist);
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
      let name = att.value
      let v = build_simple_variable(ctx, name, {typeName: "text"}, {
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
