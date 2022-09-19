import {Node, BodyNode} from 'lrxml'
import {CodeGenContext} from '../context'
import {VarScope} from '../varscope'

import {generate_argdecls} from './argdecls'
import {generate_body} from './body'

import {CodeFragment} from '../codefragment'

export function generate_widget(ctx: CodeGenContext, nodeList: BodyNode[])
 : CodeFragment
{
  let program: CodeFragment = [
    `export function render_`,
    {kind: 'name', text: ctx.part.name, source: ctx.part.nameNode},
    ` `
  ];

  //XXX: this, CON
  const scope = new VarScope(
    new Map
    , new VarScope(ctx.part.varMap, new VarScope(ctx.part.argMap))
  )

  const argDecls = generate_argdecls(ctx, scope, ctx.part);

  const implicitArgs = []
  let bodyPreamble = ""
  if (ctx.hasThis) {
    implicitArgs.push(`this: typeof ${ctx.session.templateName.join('.')}`)
    bodyPreamble += `const $this = this`;
  }
  implicitArgs.push(`CON: ${ctx.session.params.connectionTypeName}`)

  // XXX: default value
  // XXX: tmpl name
  program.push(
    "(" + implicitArgs.join(', ') + "}, ",
    argDecls,
    ") {" + bodyPreamble + "}\n",
  )

  program.push(generate_body(ctx, scope, nodeList));

  program.push("}\n");

  return program;
}
