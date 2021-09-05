import {CodeGenContext} from '../context'
import {Widget} from '../../declaration'
import {VarScope} from '../varscope'
import {varTypeExpr} from './vartype'

export function generate_argdecls(ctx: CodeGenContext<Widget>, _scope: VarScope, widget: Widget): string {
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
