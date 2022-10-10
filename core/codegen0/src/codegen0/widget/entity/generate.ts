import {Node, EntPathItem, EntTerm} from 'lrxml'
import {CodeGenContext} from '../../context'
import {VarScope} from '../../varscope'
import {escapeAsStringLiteral} from '../../escape'

import {CodeFragment, joinAsArray} from '../../codefragment'
import type {Argument} from '../../template_context/'

export function generate_entity(
  ctx: CodeGenContext, scope: VarScope, node: Node & {kind: 'entity'},
  options?: {need_runtime_escaping?: boolean}
): Argument {
  return generate_entpath(ctx, scope, node.path, options ?? {})
}

export function generate_entpath(
  ctx: CodeGenContext, scope: VarScope, path: EntPathItem[],
  {need_runtime_escaping}: {need_runtime_escaping?: boolean}
): Argument {

  const [head, ...rest] = path

  if (rest.length) {
    ctx.NIMPL(rest[0])
  }
  const result: CodeFragment[] = []
  switch (head.kind) {
    case 'var': {
      const variable = scope.lookup(head.name)
      if (variable != null) {
        // typeName
        result.push({kind: 'name', code: variable.varName, source: head})
        if (variable.typeName === "html")
          need_runtime_escaping = false;
      } else {
        const fn = ctx.session.entFns[head.name]
        if (fn == null) {
          ctx.token_error(head, `No such variable: ${head.name}`);
        }
        result.push(ctx.entFnPrefix(), ".", {kind: 'name', code: head.name, source: head}, ".apply(CON, [])");
      }
      break;
    }
    case 'call': {
      // XXX: entmacro
      const variable = scope.lookup(head.name)
      if (variable != null) {
        const args = generate_entlist(ctx, scope, head.elements, {})
        result.push({kind: 'name', code: head.name, source: head}, "(", args, "})")
      } else {
        const fn = ctx.session.entFns[head.name]
        if (fn == null) {
          ctx.token_error(head, `No such variable: ${head.name}`);
        }
        // 
        const args = generate_entlist(ctx, scope, head.elements, {})
        result.push(`${ctx.entFnPrefix()}.`,
                    {kind: 'name', code: head.name, source: head},
                    `.apply(CON, [`, args, `])`);
      }
      break;
    }
    default:
      ctx.NIMPL(head)
  }

  return {
    kind: "argument", need_runtime_escaping,
    items: joinAsArray('.', result)
  }
}

export function generate_entlist(
  ctx: CodeGenContext, scope: VarScope, nodeList: EntTerm[],
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
