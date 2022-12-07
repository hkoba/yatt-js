import {Entity} from '../../declaration'

import {CodeGenContext} from '../context'

import {generate_argdecls} from '../widget/argdecls'

import {VarScope} from '../varscope'

import {CodeFragment} from '../codefragment'

export function generate_entity(ctx: CodeGenContext<Entity>): CodeFragment {
  let program: CodeFragment = [
    `export function entity_`,
    {kind: 'name', code: ctx.part.name, source: ctx.part.nameNode},
    ` `
  ]

  const dummyScope = new VarScope
  const argDecls = generate_argdecls(ctx, dummyScope, ctx.part);

  program.push("(", argDecls, ") {\n");

  for (const item of ctx.part.raw_part!.payload) {
    if (item.kind === "text") {
      program.push(ctx.range_text(item))
    }
  }

  program.push("\n}")

  return program
}
