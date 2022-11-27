import {CodeGenContext, Part} from '../context'
import {VarScope} from '../varscope'
import {varTypeExpr} from './vartype'

export function generate_argdecls<T extends Part>(
  ctx: CodeGenContext<T>, _scope: VarScope, widget: T
): string {
  const args = []
  const types = []
  for (const [name, varSpec] of widget.argMap.entries()) {
    args.push(name); // XXX: default value
    const opt = (() => {
      if (varSpec.defaultSpec && varSpec.defaultSpec[0] === "!") {
        return ""
      }
      return "?";
    })()
    // XXX: readonly?
    const typeExpr = varTypeExpr(ctx, varSpec)
    types.push(`${name}${opt}: ${typeExpr}`);
  }
  return `{${args.join(', ')}}: {${types.join('; ')}}`
}
