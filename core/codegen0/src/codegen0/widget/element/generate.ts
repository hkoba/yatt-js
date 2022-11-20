import { Node } from 'lrxml'
import {CodeGenContext} from '../../context'
import {Widget, Variable} from '../../../declaration'
import {VarScope} from '../../varscope'
import {generate_putargs} from './putargs'

import {CodeFragment, joinAsArray} from '../../codefragment'

import {find_widget} from '../../../part-finder'

export function generate_element(
  ctx: CodeGenContext, scope: VarScope, node: Node & {kind: 'element'}
): CodeFragment
{
  // XXX: macro_if, foreach, ...
  // XXX: find_callable_var

  const [_ns, wname, ...rest] = node.path;

  const macroHandler = ctx.session.macro[`macro_${wname}`]
  if (macroHandler) {
    return macroHandler(ctx, scope, node).output
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
    const res = find_widget(ctx.session, ctx.template.folder, [wname, ...rest])
    if (res == null) {
      ctx.token_error(node, `No such widget ${node.path.join(':')}`)
    }
    calleeWidget = res.widget
    const path = res.template.path
    // console.log(`template path for widget ${node.path.join(':')}: ${path}`)

    // XXX: ctx.session.params.templateNamespace
    const modName = ctx.addImport(path)
    callExpr = (ctx.hasThis ? '$this.' : '') + modName + `.render_${calleeWidget.name}`;

  }

  if (calleeWidget == null) {
    ctx.token_error(node, `No such widget ${node.path.join(':')}`)
  }

  // XXX: ensure_generated
  // XXX: add_dependecy

  const argsExpr = generate_putargs(ctx, scope, node, calleeWidget);

  return [
    " ",
    callExpr,
    "(",
    joinAsArray(', ', implicitArgs),
    ", {",
    argsExpr,
    "});"
  ]
}

function find_callable_var(scope: VarScope, varName: string): Variable | undefined {
  const vr = scope.lookup(varName)
  if (vr != null && vr.is_callable)
    return vr;
}
