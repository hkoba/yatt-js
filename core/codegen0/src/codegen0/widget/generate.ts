import {BodyNode} from '@yatt/lrxml'
import {WidgetGenContext} from '../context'
import {VarScope} from '../varscope'

import {generate_argdecls} from './argdecls'
import {generate_body} from './body'

import {CodeFragment, joinAsArray} from '../codefragment'

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
    implicitArgs.push(['this', {kind: "type", annotation: [`: typeof ${ctx.session.templateName.join('.')}`]}])
    bodyPreamble += `const $this = this`;
  }
  implicitArgs.push(['CON', {kind: "type", annotation: [`: ${ctx.session.params.connectionTypeName}`]}])

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
