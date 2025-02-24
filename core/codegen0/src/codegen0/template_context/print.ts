import type {CodeGenContext, Part} from '../context.ts'

import type {CodeFragment, Argument, Statement} from './index.ts'

export function as_print<T extends Part>(
  ctx: CodeGenContext<T>, frag: Argument | Statement
): CodeFragment {
  switch (frag.kind) {
    case 'argument': {
      if (frag.need_runtime_escaping) {
        // console.log('as_print argument', frag)
        // XXX: CON.escape
        return [`CON.appendRuntimeValue(`, frag.items, `);`]
      } else {
        return [`CON.append(`, frag.items, `);`]
      }
    }
    case 'statement': {
      return frag.items;
    }
    default:
      ctx.NIMPL()
  }
}
