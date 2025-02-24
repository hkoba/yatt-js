import type {BodyNode} from '../../deps.ts'
import type {WidgetGenContext} from '../context.ts'
import {VarScope} from '../varscope.ts'

import {generate_argdecls} from './argdecls.ts'
import {generate_body} from './body.ts'
import {build_simple_variable} from '../../declaration/index.ts'

import {type CodeFragment, joinAsArray, typeAnnotation} from '../codefragment.ts'

export function generate_widget(ctx: WidgetGenContext, nodeList: BodyNode[])
 : CodeFragment
{
  const program: CodeFragment = [
    `export function render_`,
    {kind: 'name', code: ctx.part.name, source: ctx.part.nameNode},
    ` `
  ];

  const scope = new VarScope(
    new Map
    , new VarScope(ctx.part.varMap, new VarScope(ctx.part.argMap))
  )

  const argDecls = generate_argdecls(ctx, scope, ctx.part);

  const implicitArgs: CodeFragment[] = []
  let bodyPreamble = ""
  if (ctx.hasThis) {
    implicitArgs.push(['this', typeAnnotation(`: typeof ${ctx.session.templateName.join('.')}`)])
    bodyPreamble += `const $this = this`;
    const thisVar = build_simple_variable(ctx, '$this', {typeName: "scalar"}, {})
    scope.set('this', thisVar)
  }
  implicitArgs.push(['CON', typeAnnotation(`: ${ctx.session.params.connectionTypeName}`)])
  const conVar = build_simple_variable(ctx, 'CON', {typeName: "scalar"}, {})
  scope.set('CON', conVar)

  // XXX: default value
  // XXX: tmpl name
  program.push(
    "(", joinAsArray(', ', implicitArgs.concat(argDecls)),
    ") {" + bodyPreamble + "\n",
  )

  program.push(generate_body(ctx, scope, nodeList));

  program.push("}\n");

  return program;
}
