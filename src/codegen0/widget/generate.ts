import {Node} from 'lrxml-js'
import {CodeGenContext} from '../context'
import {Widget} from '../../declaration'
import {VarScope} from '../varscope'

import {generate_argdecls} from './argdecls'
import {generate_body} from './body'

export function generate_widget(ctx: CodeGenContext<Widget>, nodeList: Node[])
// : string
{
  let program = `export function render_${ctx.part.name} `;

  //XXX: this, CON
  const scope = new VarScope(new Map, new VarScope(ctx.part.varMap, new VarScope(ctx.part.argMap)))

  const argDecls = generate_argdecls(ctx, scope, ctx.part);

  // XXX: tmpl name
  program += `(this: typeof ${ctx.session.templateName}, CON: yatt.runtime.Connection, ${argDecls}) {const $this = this\n`;

  program += generate_body(ctx, scope, nodeList);

  program += `}\n`;

  return program;
}
