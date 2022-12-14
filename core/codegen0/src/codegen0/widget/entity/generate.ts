import {Node, EntPathItem, EntTerm, isVarOrCall} from 'lrxml'
import {CodeGenContext, Part} from '../../context'
import {VarScope} from '../../varscope'
import {escapeAsStringLiteral} from '../../escape'

import {CodeFragment, joinAsArray} from '../../codefragment'
import type {Argument} from '../../template_context/'

import {find_entity} from '../../../part-finder'

export function generate_entity<T extends Part>(
  ctx: CodeGenContext<T>, scope: VarScope, node: Node & {kind: 'entity'},
  options?: {need_runtime_escaping?: boolean}
): Argument {
  return generate_entpath(ctx, scope, node.path, options ?? {})
}

export function generate_entpath<T extends Part>(
  ctx: CodeGenContext<T>, scope: VarScope, path: EntPathItem[],
  {need_runtime_escaping}: {need_runtime_escaping?: boolean}
): Argument {
  const [head, ...rest] = path

  const result: CodeFragment[] = []

  if (isVarOrCall(head)) {
    const variable = scope.lookup(head.name)
    if (variable != null) {
      if (head.kind === "call" && !variable.is_callable) {
        ctx.token_error(head, `Variable is not a callable: ${head.name}`);
      }
      if (variable.typeName === "html") {
        need_runtime_escaping = false;
      }
      result.push({kind: 'name', code: variable.varName, source: head})
    } else {
      const entitySpec = find_entity(ctx.session, ctx.template, head.name)
      if (entitySpec == null) {
        console.log(`entFns: `, ctx.session.entFns)
        ctx.token_error(head, `No such entity: ${head.name}`);
      }

      if (typeof entitySpec !== "string"
        && entitySpec.template === ctx.template) {
        if (ctx.hasThis) {
          result.push('$this.')
        }
      } else {
        result.push(`${ctx.entFnPrefix()}.`)
      }

      result.push({kind: 'name', code: head.name, source: head})

      const args = head.kind === "call"
        ? generate_entlist(ctx, scope, head.elements, {})
        : [];

      result.push(`.apply(CON, [`, args, `])`);
    }
  }
  else {
    ctx.NIMPL(head)
  }

  if (rest.length) {
    ctx.NIMPL(rest[0])
  }

  return {
    kind: "argument", need_runtime_escaping,
    items: result
  }
}

export function generate_entlist<T extends Part>(
  ctx: CodeGenContext<T>, scope: VarScope, nodeList: EntTerm[],
  options: {need_runtime_escaping?: boolean}
): CodeFragment {
  const exprList: CodeFragment[] = nodeList.map(term => {
    if (term instanceof Array) {
      return generate_entpath(ctx, scope, term, options).items
    } else {
      return {kind: 'other', code: escapeAsStringLiteral(term.text)
              , source: term}
    }
  })
  return joinAsArray(', ', exprList)
}
