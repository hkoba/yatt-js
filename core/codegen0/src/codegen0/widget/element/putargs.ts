import {
  Node, AttItem, isIdentOnly, isBareLabeledAtt, hasStringValue
} from 'lrxml'
import {WidgetGenContext, Widget} from '../../context'
import {VarScope} from '../../varscope'
import {generate_argdecls} from '../argdecls'
import {generate_body} from '../body'

import {CodeFragment, joinAsArray} from '../../codefragment'

import {generate_as_cast_to} from '../../template_context/cast'

export function generate_putargs(
  ctx: WidgetGenContext, scope: VarScope, node: Node & {kind: 'element'}
  , calleeWidget: Widget
  // , delegateVars
): CodeFragment
{
  const formalArgs = calleeWidget.argMap;
  const actualArgs: Map<string, CodeFragment> = new Map
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
      actualArgs.set(formalName, [
        {kind: 'name', code: formalName, source: argSpec.label},
        ": ",
        generate_as_cast_to(ctx, scope, formal, argSpec)
      ])
    }
    else if (argSpec.kind === "attelem") {
      // <:yatt:name>...</:yatt:name>
      ctx.NIMPL()
    }
    else {
      // 'foo' "bar"
      // entity, nest
      console.dir(argSpec, {colors: true, depth: null});
      ctx.NIMPL()
    }
  }

  if (node.children?.length) {
    const BODY_NAME = ctx.session.params.body_argument_name; // XXX: ctx
    if (actualArgs.has(BODY_NAME))
      ctx.token_error(node, `${BODY_NAME} argument is already specified`);
    const BODY = formalArgs.get(BODY_NAME);
    if (BODY != null) {
      switch (BODY.typeName) {
        case "widget": {
          const argDecls = generate_argdecls(ctx, scope, BODY.widget);
          const bodyProgram = generate_body(ctx, scope, node.children);
          const conT = ctx.session.params.connectionTypeName
          actualArgs.set(
            BODY_NAME,
            [
              {kind: 'name', code: BODY_NAME},
              ": (",
              {kind: 'name', code: 'CON'},
              `: ${conT}, `,
              argDecls,
              "): void => {",
              bodyProgram,
              "}"
            ]
          )
          break;
        }
        case "html":
        default:
          ctx.NIMPL();
      }
    }
  }
  // XXX: node.footer
  return joinAsArray(', ', Array.from(actualArgs.values()))

  function passThrough(
    argSpec: AttItem, formalName: string, actualName: string
  ) {
    if (! formalArgs.has(formalName)) {
      ctx.token_error(argSpec, `No such argument: ${formalName}`)
    }
    const formal = formalArgs.get(formalName)!
    const actual = scope.lookup(actualName)
    if (actual == null) {
      ctx.token_error(argSpec, `No such variable: ${actualName}`)
    }
    if (formal.typeName !== actual.typeName) {
      ctx.token_error(argSpec, `Variable type mismatch: ${formalName}
Expected: ${formal.typeName} Got: ${actual.typeName}`)
    }
    if (actualArgs.has(formalName)) {
      ctx.token_error(argSpec, `Duplicate argument: ${formalName}`)
    }
    actualArgs.set(formalName, `${formalName}: ${actualName}`)
  }
}
