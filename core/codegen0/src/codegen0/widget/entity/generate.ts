import {Node} from 'lrxml-js'
import {CodeGenContext} from '../../context'
import {Widget} from '../../../declaration'
import {VarScope} from '../../varscope'

export function generate_entity(
  ctx: CodeGenContext<Widget>, scope: VarScope, node: Node & {kind: 'entity'}
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
    case 'call':
    default:
      ctx.NIMPL()
  }
}
