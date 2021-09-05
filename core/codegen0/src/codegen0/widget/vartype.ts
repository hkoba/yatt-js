import {CodeGenContext} from '../context'
import {Variable, Widget} from '../../declaration'

export function varTypeExpr(ctx: CodeGenContext<Widget>, vr: Variable): string {
  switch (vr.typeName) {
    case "text":
      return 'string';
    case "widget": {
      // [...vr.widget.argMap.values()].map((a) => {
      // })
      return `(CON: yatt.runtime.Connection, {}: {}) => void`;
    }
    default:
      ctx.NIMPL();
  }
}
