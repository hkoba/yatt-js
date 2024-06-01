import {type AttItem, isIdentOnly} from '../deps.ts'

import type {BuilderContext} from './context.ts'

import type {Part, Widget} from './part.ts'

import type {DelegateVar} from './vartype.ts'

import {add_args_cont, type ArgAdder} from './addArgs.ts'

export function build_delegate_variable_adder(
  ctx: BuilderContext, part: Part, gen: Generator<AttItem>,
  att: AttItem, argNo: number,
  name: string, restName: string[], attlist: AttItem[]
): ArgAdder {
  return {
    name: part.name, dep: restName.length ? restName.join(":") : name,
    fun: (widget: Widget): ArgAdder | undefined => {
      const v: DelegateVar = {
        typeName: "delegate", varName: name,
        widget,
        delegateVars: new Map,
        attItem: att, argNo,
        is_callable: true, from_route: false,
        is_body_argument: false,
        is_escaped: false
      }

      part.varMap.set(name, v)

      if (attlist.length) {
        for (const att of attlist) {
          if (! isIdentOnly(att)) {
            ctx.NIMPL()
          }
          const name = att.value
          if (! widget.argMap.has(name)) {
            ctx.throw_error(`No such argument ${name} in delegated widget ${widget.name}`)
          }
          // XXX: deep copy, with original link?
          part.argMap.set(name, widget.argMap.get(name)!)
        }
      } else {
        for (const [name, value] of widget.argMap.entries()) {
          if (part.argMap.has(name)) {
            if (ctx.debug) {
              // XXX: better diag
              console.log(`skipping ${name} because it already exists`)
            }
            continue
          }
          part.argMap.set(name, value)
        }
      }
      return add_args_cont(ctx, part, gen)
    }
  }
}

