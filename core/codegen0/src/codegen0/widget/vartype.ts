import {CodeGenContext, Part} from '../context'
import {Variable} from '../../declaration'

export function varTypeExpr<T extends Part>(ctx: CodeGenContext<T>, vr: Variable): string {
  switch (vr.typeName) {
    case "text":
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
    default:
      ctx.NIMPL();
  }
}
