import type {Entity} from '../../declaration/index.ts'

import type {CodeGenContext} from '../context.ts'

import {type CodeFragment, joinAsArray} from '../codefragment.ts'

import {varTypeExpr} from '../widget/vartype.ts'

export function generate_entity(ctx: CodeGenContext<Entity>): CodeFragment {
  const program: CodeFragment = []

  if (ctx.session.cgenStyle !== 'populator') {
    program.push(`export function `)
  }

  program.push({kind: 'name', code: ctx.part.name, source: ctx.part.nameNode})

  const argDecls = generate_entity_argdecls(ctx, ctx.part)

  program.push("(", joinAsArray(', ', argDecls), ") {\n");

  for (const item of ctx.part.payloads) {
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

  const argList: CodeFragment[] = []

  for (const [name, spec] of entityDecl.argMap.entries()) {
    const label = spec.attItem?.label
    const arg: CodeFragment[] = [{kind: 'name', code: name, source: label}]
    // if (spec.typeName) {
    //   arg.push(': ', {kind: 'name', code: spec.typeName});
    // }
    argList.push(arg);
  }

  return argList
}
