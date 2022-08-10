import {AttStringItem} from 'lrxml'
import {CodeGenContext} from '../context'
import {VarScope} from '../varscope'
import {generate_entity} from './entity/generate'
import {Printable} from './entity/types'

export function generate_attstring(ctx: CodeGenContext, scope: VarScope,
                                   nodeList: AttStringItem[]): string {
  let program = ""
  for (const node of nodeList) {
    switch (node.kind) {
      case "text":
        program += ctx.range_text(node)
        break;
      case "entity":
        program += as_expr(ctx, generate_entity(ctx, scope, node))
        break;
      default:
        ctx.NIMPL(node)
    }
  }
  return program
}

function as_expr(ctx: CodeGenContext, printable: Printable): string {
  switch (printable.kind) {
    case 'var': {
      // XXX: lvalue aware casting
      switch (printable.variable.typeName) {
        case 'text':
          return printable.variable.varName
        case 'html':
          return printable.variable.varName
        default:
          ctx.NIMPL(printable.variable)
      }
      break;
    }
    case 'expr': {
      return printable.text
    }
    default:
      ctx.NIMPL(printable)
  }
}
