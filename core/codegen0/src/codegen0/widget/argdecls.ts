import type {CodeGenContext, Part} from '../context.ts'
import type {VarScope} from '../varscope.ts'
import {varTypeExpr} from './vartype.ts'

import {type CodeFragment, joinAsArray} from '../codefragment.ts'
import { DefaultFlag } from "../../declaration/vartype.ts";

import {generate_attstring_as_cast_to} from '../template_context/index.ts'

export function generate_argdecls<T extends Part>(
  ctx: CodeGenContext<T>, scope: VarScope, widget: T
): {argDecls: CodeFragment[], defaultInits: CodeFragment[]} {
  const args: CodeFragment[] = []
  const types: CodeFragment[] = []

  const defaultInits: CodeFragment[] = []

  for (const [name, varSpec] of widget.argMap.entries()) {
    // XXX: default value
    const nameCode: CodeFragment = {
      kind: 'name', code: name, source: varSpec.attItem
    }
    args.push(nameCode);

    const typeAnot: CodeFragment[] = []
    typeAnot.push(nameCode)
    if (!(varSpec.defaultSpec && varSpec.defaultSpec[0] === "!")) {
      typeAnot.push("?")
    }
    typeAnot.push(`: `, varTypeExpr(ctx, varSpec))

    types.push(typeAnot)

    if (varSpec.defaultSpec) {
      const [dflag, _defaultExpr, children] = varSpec.defaultSpec
      const cond = generate_dflag_condition(name, dflag)
      const as_cast = generate_attstring_as_cast_to(ctx, scope, varSpec, children)
      defaultInits.push(`if (`, cond, `) {`, name, ` = `, as_cast, `}`)
    }
  }
  return {defaultInits, argDecls: [
    ["{",
    joinAsArray(', ', args),
    "}",
    {kind: "type", annotation: [
      ": {",
      joinAsArray('; ', types),
      "}"
    ]}]
  ]}
}

function generate_dflag_condition(
  name: string, dflag: DefaultFlag
): CodeFragment[] {
  switch (dflag) {
    case "|": {
      return [name]
    }
    case "?": {
      return [name, ` == null || `, name, ` === ""`]
    }
    case "/": {
      return [name, ` == null`]
    }
    default: {
      throw new Error(`Invalid dflag: ${dflag}`)
    }
  }
}
