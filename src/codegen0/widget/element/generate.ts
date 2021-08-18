import {
  Node, AttItem, isIdentOnly, isBareLabeledAtt, hasStringValue
} from 'lrxml-js'
import {CodeGenContext} from '../../context'
import {Widget, Variable} from '../../../declaration'
import {VarScope} from '../../varscope'
import {escapeAsStringLiteral} from '../../escape'
import {generate_argdecls} from '../argdecls'
import {generate_body} from '../body'

export function generate_element(
  ctx: CodeGenContext<Widget>, scope: VarScope, node: Node & {kind: 'element'}
) // : string
{
  // XXX: macro_if, foreach, ...
  // XXX: find_callable_var

  const [_ns, wname, ...rest] = node.path;

  let callExpr: string | undefined
  let calleeWidget: Widget | undefined

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
    callExpr = `this.render_${wname}`;
  }
  else {
    console.dir(node.path, {color: true, depth: null})
    ctx.NIMPL()
  }

  if (calleeWidget == null) {
    ctx.token_error(node, `No such widget ${node.path.join(':')}`)
  }

  // XXX: ensure_generated
  // XXX: add_dependecy

  const argsExpr = gen_putargs(ctx, scope, node, calleeWidget);

  return ` ${callExpr}(CON, {${argsExpr}});`
}

function find_callable_var(scope: VarScope, varName: string): Variable | undefined {
  const vr = scope.lookup(varName)
  if (vr != null && vr.is_callable)
    return vr;
}

function gen_putargs(
  ctx: CodeGenContext<Widget>, scope: VarScope, node: Node & {kind: 'element'}
  , calleeWidget: Widget
  // , delegateVars
) :string
{
  const formalArgs = calleeWidget.argMap;
  const actualArgs = new Map
  for (const argSpec of node.attlist) {
    if (argSpec.kind === "attelem") {
      // <:yatt:name>...</:yatt:name>
      ctx.NIMPL()
    }
    else if (isBareLabeledAtt(argSpec) && argSpec.kind === "identplus") {
      // XXX: typecheck!
      // name=name
      passThrough(argSpec, argSpec.label.value, argSpec.value)
    }
    else if (isIdentOnly(argSpec)) {
      // XXX: typecheck!
      // name
      passThrough(argSpec, argSpec.value, argSpec.value)
    }
    else if (isBareLabeledAtt(argSpec) && hasStringValue(argSpec)) {
      // name='foo' name="bar"
      const formalName = argSpec.label.value
      if (! formalArgs.has(formalName)) {
        ctx.token_error(argSpec, `No such argument: ${formalName}`)
      }
      const formal = formalArgs.get(formalName)!
      if (actualArgs.has(formalName)) {
        ctx.token_error(argSpec, `Duplicate argument: ${formalName}`)
      }
      if (formal.typeName !== 'text')
        ctx.NIMPL(formal);

      const s = escapeAsStringLiteral(argSpec.value)
      actualArgs.set(formalName, `${formalName}: ${s}`)
    }
    else {
      // 'foo' "bar"
      // entity, nest
      console.dir(argSpec, {color: true, depth: null});
      ctx.NIMPL()
    }
  }

  // XXX: node.children as BODY
  if (node.children?.length) {
    if (actualArgs.has('BODY'))
      ctx.token_error(node, `BODY argument is already specified`);
    const BODY = formalArgs.get('BODY')!;
    switch (BODY.typeName) {
      case "widget": {
        const argDecls = generate_argdecls(ctx, scope, BODY.widget);
        const bodyProgram = generate_body(ctx, scope, node.children);
        actualArgs.set('BODY', `BODY: (CON: yatt.runtime.Connection, ${argDecls}): void => {${bodyProgram}}`)
        break;
      }
      case "html":
      default:
        ctx.NIMPL();
    }
  }
  // XXX: node.footer
  return [...actualArgs.values()].join(', ');

  function passThrough(argSpec: AttItem, formalName: string, actualName: string) {
    if (! formalArgs.has(formalName)) {
      ctx.token_error(argSpec, `No such argument: ${formalName}`)
    }
    const formal = formalArgs.get(formalName)!
    const actual = scope.lookup(actualName)
    if (actual == null) {
      ctx.token_error(argSpec, `No such variable: ${actualName}`)
    }
    if (formal.typeName !== actual.typeName) {
      ctx.token_error(argSpec, `Variable type mismatch: ${formalName}\nExpected: ${formal.typeName} Got: ${actual.typeName}`)
    }
    if (actualArgs.has(formalName)) {
      ctx.token_error(argSpec, `Duplicate argument: ${formalName}`)
    }
    actualArgs.set(formalName, `${formalName}: ${actualName}`)
  }
}
