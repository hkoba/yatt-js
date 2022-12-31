import {Action} from '../../declaration'

import {CodeGenContext} from '../context'

import {VarScope} from '../varscope'

import {CodeFragment} from '../codefragment'

// import {varTypeExpr} from '../widget/vartype'

import {generate_argdecls} from '../widget/argdecls'

export function generate_action(ctx: CodeGenContext<Action>): CodeFragment {
  let program: CodeFragment = [
    `export function do_`,
    {kind: 'name', code: ctx.part.name, source: ctx.part.nameNode},
    ` `
  ];

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

  program.push(
    "(" + implicitArgs.join(', ') + ", ",
    argDecls,
    ") {" + bodyPreamble + "\n",
  )

  for (const item of ctx.part.raw_part!.payload) {
    if (item.kind === "text") {
      program.push(ctx.range_text(item))
    }
  }

  program.push("\n}")

  return program
}