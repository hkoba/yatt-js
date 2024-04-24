import {Entity} from '../../declaration/index.ts'

import {CodeGenContext} from '../context.ts'

import {CodeFragment, joinAsArray} from '../codefragment.ts'

import {varTypeExpr} from '../widget/vartype.ts'

export function generate_entity(ctx: CodeGenContext<Entity>): CodeFragment {
  let program: CodeFragment = [
    `export function `,
    {kind: 'name', code: ctx.part.name, source: ctx.part.nameNode},
  ]

  const argDecls = generate_entity_argdecls(ctx, ctx.part)

  program.push("(", joinAsArray(', ', argDecls), ") {\n");

  for (const item of ctx.part.raw_part!.payload) {
    if (item.kind === "text") {
      program.push(ctx.range_text(item))
    }
  }

  program.push("\n}")

  return program
}

export function generate_entity_argdecls(
  ctx: CodeGenContext<Entity>,
  entityDecl: Entity
): CodeFragment[] {

  let args: CodeFragment[] = []

  for (const [name, spec] of entityDecl.argMap.entries()) {
    const label = spec.attItem?.label
    args.push([{kind: 'name', code: name, source: label}
               , ': '
               , {kind: 'name', code: varTypeExpr(ctx, spec)}
              ])
  }

  return args
}
