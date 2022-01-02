import {CodeGenContext} from '../context'
import {Variable, Widget} from '../../declaration'

export function varTypeExpr(ctx: CodeGenContext, vr: Variable): string {
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
