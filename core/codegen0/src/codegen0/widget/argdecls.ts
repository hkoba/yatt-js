import {Node} from 'lrxml'
import {CodeGenContext, Part} from '../context'
import {VarScope} from '../varscope'
import {varTypeExpr} from './vartype'

import {CodeFragment, joinAsArray} from '../codefragment'

export function generate_argdecls<T extends Part>(
  ctx: CodeGenContext<T>, _scope: VarScope, widget: T
): CodeFragment {
  const args: CodeFragment[] = []
  const types: CodeFragment[] = []
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

  }
  return [
    "{",
    joinAsArray(', ', args),
    "}: {",
    joinAsArray('; ', types),
    "}"
  ]
}
