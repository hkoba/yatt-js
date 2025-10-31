import type {CodeGenContext, Part} from '../context.ts'
import type {Variable} from '../../declaration/index.ts'

export function varTypeExpr<T extends Part>(ctx: CodeGenContext<T>, vr: Variable): string {
  switch (vr.typeName) {
    case "text": case "html":
      return 'string';
    case "widget": {
      // [...vr.widget.argMap.values()].map((a) => {
      // })
      return `(CON: ${ctx.session.params.connectionTypeName}, {}: {}) => void`;
    }
    case "scalar": {
      // XXX: better type
      return "any"
    }
    case "list": {
      // XXX: better type
      return "any[]";
    }
    default:
      ctx.NIMPL();
  }
}
