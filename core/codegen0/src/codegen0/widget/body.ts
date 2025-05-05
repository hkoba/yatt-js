import type {Node} from '../../deps.ts'
import type {WidgetGenContext} from '../context.ts'
import type {VarScope} from '../varscope.ts'
import {escapeAsStringLiteral} from '../escape.ts'
import {indent} from '../context.ts'

import {generate_element} from './element/generate.ts'
import {generate_entity} from './entity/generate.ts'

import type {CodeFragment} from '../codefragment.ts'

import {as_print} from '../template_context/print.ts'

export async function generate_body(
  ctx: WidgetGenContext,
  scope: VarScope,
  nodeList: Node[]
): Promise<CodeFragment>
{
  const program: CodeFragment = []
  let pendingIndent = false
  for (const node of nodeList) {
    if (node.kind === 'comment') continue
    if (pendingIndent) {
      program.push(indent(ctx.session))
      pendingIndent = false
    }
    switch (node.kind) {
      case "attelem":
      case "lcmsg": {
        ctx.NIMPL(node);
        break;
      }
      case "pi": {
        const inner = ctx.range_text(node.innerRange)
        let match
        if (!(match = inner.match(/^=(==)?/))) {
          program.push({kind: 'other', code: inner + ";", source: node})
        } else {
          const need_runtime_escaping = match[0].length == 1;
          program.push(as_print(ctx, {
            kind: 'argument',
            items: inner.substring(match[0].length),
            need_runtime_escaping
          }))
        }
        break;
      }
      case "text": {
        program.push(as_print(ctx, {
          kind: 'argument',
          items: escapeAsStringLiteral(ctx.range_text(node)),
        }))

        if (node.lineEndLength) {
          program.push("\n");
          pendingIndent = true;
        }
        break;
      }
      case "element":
        program.push(await generate_element(ctx, scope, node));
        break;
      case "entity":
        program.push(as_print(ctx, generate_entity(ctx, scope, node, {
          need_runtime_escaping: true
        })));
        break;
      default:
        ctx.NEVER();
    }
  }

  // console.log(`body program:`, program)

  return program;
}
