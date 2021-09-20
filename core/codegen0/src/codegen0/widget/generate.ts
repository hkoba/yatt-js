import {Node} from 'lrxml-js'
import {CodeGenContext} from '../context'
import {Widget} from '../../declaration'
import {VarScope} from '../varscope'

import {generate_argdecls} from './argdecls'
import {generate_body} from './body'

export function generate_widget(ctx: CodeGenContext, nodeList: Node[])
// : string
{
  let program = `export function render_${ctx.part.name} `;

  //XXX: this, CON
  const scope = new VarScope(new Map, new VarScope(ctx.part.varMap, new VarScope(ctx.part.argMap)))

  const argDecls = generate_argdecls(ctx, scope, ctx.part);

  const implicitArgs = []
  let bodyPreamble = ""
  if (ctx.hasThis) {
    implicitArgs.push(`this: typeof ${ctx.session.templateName.join('.')}`)
    bodyPreamble += `const $this = this`;
  }
  implicitArgs.push(`CON: yatt.runtime.Connection`)

  // XXX: tmpl name
  program += `(${implicitArgs.join(', ')}, ${argDecls}) {${bodyPreamble}\n`;

  program += generate_body(ctx, scope, nodeList);

  program += `}\n`;

  return program;
}
