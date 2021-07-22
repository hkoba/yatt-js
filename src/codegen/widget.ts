import { Node, EntNode, EntPath } from 'lrxml-js'

import { BuilderContext, Part } from '../declaration/'

export function generate_widget(ctx: BuilderContext, name: string, part: Part, ast: Node[]): string {
  let program = `export function render_${name} `

  const args = ['CON', ...part.argMap.keys()].join(", ")
  program += `(${args}) {`
  //
  program += '\n'
  for (const item of ast) {
    switch (item.kind) {
      case "comment": {
        // lineNo?
        break;
      }
      case "text": {
        let cnt = 0
        for (let line of ctx.range_text(item).split(/(\r?\n)/)) {
          if (cnt++ % 2 == 1) {
            program += ' + "\\n");\n'
          } else {
            // XXX: escape "", \
            program += `CON.append("${line}"`
          }
        }
        program += ');'
        break;
      }
      case "element": {
        program += `(call to ${item.path})\n`
        break;
      }
      case "entity": {
        program += ` (ref to ${item});`
        break;
      }
      default: {
        ctx.NIMPL(item)
      }
    }
  }

  program += `}\n`
  return program
}

function from_entity(ctx: BuilderContext, node: EntNode): string {
  return gen_entpath(ctx, node.path)
}

function gen_entpath(ctx: BuilderContext, path: EntPath): string {
  if (path.length === 0)
    return ''

  const [head, rest] = path

  let script = ''
  if (head instanceof Array) {
    ctx.NIMPL()
  } else {
    switch (head.kind) {
      case "var": {
        script += head.name
        break
      }
      default: {
        ctx.NIMPL()
      }
    }
  }

  return path.reduce((acc, cur) => {
    switch (cur.kind) {
      case "invoke":
      case "aref":
      case "href":
      default:
    }
    return acc + cur;
  }, script)
}
