import {
  Node, AttItem, isIdentOnly, isBareLabeledAtt, hasStringValue
} from 'lrxml-js'
import {CodeGenContext} from '../../context'
import {Widget} from '../../../declaration'
import {VarScope} from '../../varscope'
import {escapeAsStringLiteral} from '../../escape'
import {generate_argdecls} from '../argdecls'
import {generate_body} from '../body'

export function generate_putargs(
  ctx: CodeGenContext<Widget>, scope: VarScope, node: Node & {kind: 'element'}
  , calleeWidget: Widget
  // , delegateVars
) :string
{
  const formalArgs = calleeWidget.argMap;
  const actualArgs = new Map
  for (const argSpec of node.attlist) {
    if (isBareLabeledAtt(argSpec) && argSpec.kind === "identplus") {
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
    else if (argSpec.kind === "attelem") {
      // <:yatt:name>...</:yatt:name>
      ctx.NIMPL()
    }
    else {
      // 'foo' "bar"
      // entity, nest
      console.dir(argSpec, {color: true, depth: null});
      ctx.NIMPL()
    }
  }

  if (node.children?.length) {
    const BODY_NAME = ctx.session.params.body_argument_name; // XXX: ctx
    if (actualArgs.has(BODY_NAME))
      ctx.token_error(node, `${BODY_NAME} argument is already specified`);
    const BODY = formalArgs.get(BODY_NAME)!;
    switch (BODY.typeName) {
      case "widget": {
        const argDecls = generate_argdecls(ctx, scope, BODY.widget);
        const bodyProgram = generate_body(ctx, scope, node.children);
        actualArgs.set(BODY_NAME, `${BODY_NAME}: (CON: yatt.runtime.Connection, ${argDecls}): void => {${bodyProgram}}`)
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
