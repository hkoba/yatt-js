import {BodyNode} from '../../deps.ts'
import {WidgetGenContext} from '../context.ts'
import {VarScope} from '../varscope.ts'

import {generate_argdecls} from './argdecls.ts'
import {generate_body} from './body.ts'

import {CodeFragment, joinAsArray, typeAnnotation} from '../codefragment.ts'

export function generate_widget(ctx: WidgetGenContext, nodeList: BodyNode[])
 : CodeFragment
{
  let program: CodeFragment = [
    `export function render_`,
    {kind: 'name', code: ctx.part.name, source: ctx.part.nameNode},
    ` `
  ];

  //XXX: this, CON
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
  }
  implicitArgs.push(['CON', typeAnnotation(`: ${ctx.session.params.connectionTypeName}`)])

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
