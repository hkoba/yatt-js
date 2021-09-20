import { Node } from 'lrxml-js'
import {CodeGenContext} from '../../context'
import {Widget, Variable} from '../../../declaration'
import {VarScope} from '../../varscope'
import {generate_putargs} from './putargs'

export function generate_element(
  ctx: CodeGenContext, scope: VarScope, node: Node & {kind: 'element'}
) // : string
{
  // XXX: macro_if, foreach, ...
  // XXX: find_callable_var

  const [_ns, wname, ...rest] = node.path;

  const macroHandler = ctx.session.macro[`macro_${wname}`]
  if (macroHandler) {
    return macroHandler(ctx, scope, node)
  }

  let callExpr: string | undefined
  let calleeWidget: Widget | undefined
  let implicitArgs = ['CON'];

  const callable_var = find_callable_var(scope, wname);

  if (callable_var) {
    switch (callable_var.typeName) {
      case "widget":
        calleeWidget = callable_var.widget;
        callExpr = `${callable_var.varName} && ${callable_var.varName}`;
        break;
      default:
        ctx.NIMPL();
    }
  }
  else if (rest.length === 0 && ctx.template.partMap.widget.has(wname)) {
    calleeWidget = ctx.template.partMap.widget.get(wname)!
    callExpr = (ctx.hasThis ? '$this.' : '') + `render_${wname}`;
  }
  else {
    ctx.token_error(node, `Not yet implemented call`)
  }

  if (calleeWidget == null) {
    ctx.token_error(node, `No such widget ${node.path.join(':')}`)
  }

  // XXX: ensure_generated
  // XXX: add_dependecy

  const argsExpr = generate_putargs(ctx, scope, node, calleeWidget);

  return ` ${callExpr}(${implicitArgs.join(', ')}, {${argsExpr}});`
}

function find_callable_var(scope: VarScope, varName: string): Variable | undefined {
  const vr = scope.lookup(varName)
  if (vr != null && vr.is_callable)
    return vr;
}
