import { ParserContext, Node, EntNode, EntPath } from 'lrxml-js'
import { Part } from '../part-set/build'

export function generate_widget(ctx: ParserContext, name: string, part: Part, ast: Node[]): string {
    let program = `export function render_${name} `

    const args = ['CON', ...Object.keys(part.arg_dict)].join(", ")
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

function from_entity(ctx: ParserContext, node: EntNode): string {
    return gen_entpath(ctx, node.path)
}

function gen_entpath(ctx: ParserContext, path: EntPath): string {
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
