import { ParserContext, Node } from 'lrxml-js'
import { Part } from '../part-set/build'

export function generate_widget(ctx: ParserContext, name: string, part: Part, ast: Node[]): string {
    let program = `export function render_${name} `

    const args = ['CON', ...Object.keys(part.arg_dict)].join(", ")
    program += `(${args}) { `
    //
    program += '\n'
    for (const item of ast) {
        switch (item.kind) {
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
            default: {
                
            }
        }
    }

    program += `}\n`
    return program
}
