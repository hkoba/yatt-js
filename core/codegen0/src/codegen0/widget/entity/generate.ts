import {Node, EntPathItem, EntTerm} from 'lrxml-js'
import {CodeGenContext} from '../../context'
import {Widget} from '../../../declaration'
import {VarScope} from '../../varscope'
import type {Printable} from './types'
import {escapeAsStringLiteral} from '../../escape'

export function generate_entity(
  ctx: CodeGenContext, scope: VarScope, node: Node & {kind: 'entity'}
) {
  if (node.path.length !== 1) {
    ctx.NIMPL()
  }

  return generate_entpath(ctx, scope, node.path)
}

export function generate_entpath(
  ctx: CodeGenContext, scope: VarScope, path: EntPathItem[]
): Printable {

  const [head, ...rest] = path

  const result: string[] = []
  switch (head.kind) {
    case 'var': {
      const variable = scope.lookup(head.name)
      if (variable == null)
        ctx.token_error(head, `No such variable: ${head.name}`);

      if (! rest.length)
        return {kind: "var", variable}

      result.push(head.name)
      break;
    }
    case 'call': {
      const fn = ctx.session.entFns[head.name]
      if (fn == null)
        ctx.token_error(head, `No such entity function: ${head.name}`)
      const args = generate_entlist(ctx, scope, head.elements)
      result.push(`\$${ctx.primaryNS()}.${head.name}.apply(CON, [${args}])`);
      break;
    }
    default:
      ctx.NIMPL(head)
  }

  if (rest.length) {
    ctx.NIMPL(rest[0])
  }

  return {
    kind: "expr",
    text: result.join('.')
  }
}

export function generate_entlist(
  ctx: CodeGenContext, scope: VarScope, nodeList: EntTerm[]
): string {
  const exprList = nodeList.map(term => {
    if (term instanceof Array) {
      const pathExpr = generate_entpath(ctx, scope, term)
      if (pathExpr.kind === "var")
        return pathExpr.variable.varName
      return pathExpr.text
    } else {
      return escapeAsStringLiteral(term.text)
    }
  })
  return exprList.join(', ')
}
