import {Node} from 'lrxml-js'
import {CodeGenContext} from '../../context'
import {Widget} from '../../../declaration'
import {VarScope} from '../../varscope'

export function generate_entity(
  ctx: CodeGenContext, scope: VarScope, node: Node & {kind: 'entity'}
) {
  if (node.path.length !== 1) {
    ctx.NIMPL()
  }
  const head = node.path[0]
  switch (head.kind) {
    case 'var': {
      const variable = scope.lookup(head.name)
      if (variable == null)
        ctx.token_error(node, `No such variable: ${head.name}`);
      // XXX: type specific generation
      return ` CON.appendUntrusted(${head.name});`
    }
    case 'call': {
      const fn = ctx.session.entFns[head.name]
      if (fn == null)
        ctx.token_error(node, `No such entity function: ${head.name}`)
      console.dir(node, {depth: null, color: true})
      // XXX: arguments
      return ` \$${ctx.primaryNS()}.${head.name}.apply(CON, [])`;
    }
    default:
      ctx.NIMPL()
  }
}
