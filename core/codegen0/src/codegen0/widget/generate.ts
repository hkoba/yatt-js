import type {BodyNode} from '../../deps.ts'
import type {WidgetGenContext} from '../context.ts'
import {VarScope} from '../varscope.ts'

import {generate_argdecls} from './argdecls.ts'
import {generate_body} from './body.ts'
import {build_simple_variable} from '../../declaration/index.ts'

import {
  type CodeFragment, joinAsArray, typeAnnotation
} from '../codefragment.ts'

export function generate_widget_signature(
  ctx: WidgetGenContext
): {signature: CodeFragment[], scope: VarScope, bodyPreamble: CodeFragment[]}
{
  const program: CodeFragment = [];
  program.push(`render_`);
  program.push(
    {kind: 'name', code: ctx.part.name, source: ctx.part.nameNode}, ` `
  )

  const scope = new VarScope(
    new Map
    , new VarScope(ctx.part.varMap, new VarScope(ctx.part.argMap))
  )

  const argDecls = generate_argdecls(ctx, scope, ctx.part);

  const implicitArgs: CodeFragment[] = [];
  const bodyPreamble: CodeFragment  = []
  if (ctx.hasThis) {
    implicitArgs.push(['this',
      typeAnnotation(`: typeof ${ctx.session.templateName.join('.')}`)
    ])
    if (ctx.session.cgenStyle !== 'populator') {
      bodyPreamble.push(`const $this = this;`);
    }
    const thisVar = build_simple_variable(
      ctx, '$this', {typeName: "scalar"}, {}
    )
    scope.set('this', thisVar)
  }
  implicitArgs.push(['CON',
    typeAnnotation(`: ${ctx.session.params.connectionTypeName}`)
  ])
  const conVar = build_simple_variable(ctx, 'CON', {typeName: "scalar"}, {})
  scope.set('CON', conVar)

  // XXX: default value
  // XXX: tmpl name
  program.push(
    "(", joinAsArray(', ', implicitArgs.concat(argDecls)), ")"
  )

  program.push(typeAnnotation(`: void`))

  return {signature: program, scope, bodyPreamble}
}

export async function generate_widget(ctx: WidgetGenContext, nodeList: BodyNode[])
 : Promise<CodeFragment>
{

  const program: CodeFragment = []

  const {signature, scope, bodyPreamble} = generate_widget_signature(ctx)

  program.push(signature)

  program.push(" {", bodyPreamble, "\n")

  program.push(await generate_body(ctx, scope, nodeList));

  program.push("}\n");

  return program;
}
