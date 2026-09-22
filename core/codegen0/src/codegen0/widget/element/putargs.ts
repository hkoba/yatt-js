import {
  type Node, type AttItem, isIdentOnly, hasQuotedStringValue,
  attShape,
  maybePassThruVarName, maybeArgName
} from '../../../deps.ts'
import type {WidgetGenContext, Widget} from '../../context.ts'
import {VarScope} from '../../varscope.ts'
import {isEscapedVariable} from '../../../declaration/vartype.ts'
import type {Variable} from '../../../declaration/vartype.ts'
import {generate_argdecls} from '../argdecls.ts'
import {generate_body} from '../body.ts'

import {type CodeFragment, joinAsArray} from '../../codefragment.ts'

import {generate_as_cast_to} from '../../template_context/cast.ts'

function elementPath(node: Node & {kind: 'element'}): string {
  return node.path.join(":")
}

export async function generate_putargs(
  ctx: WidgetGenContext, scope: VarScope, node: Node & {kind: 'element'}
  , calleeWidget: Widget
  // , delegateVars
): Promise<CodeFragment>
{
  const formalArgs = calleeWidget.argMap;
  const positionalArgs = formalArgs.entries()
  const actualArgs: Map<string, CodeFragment> = new Map
  for (const argSpec of node.attlist) {

    // formal
    let argName: string | undefined
    let formalVar: Variable | undefined
    let is_spread: boolean | undefined

    const s = attShape(argSpec)
    if (s.shape === "positional") {
      // ".." '..' .. [..] &yatt:entity();

      const nextArg = positionalArgs.next()
      if (nextArg.done) {
        ctx.token_error(argSpec, `Too many arguments for widget <${elementPath(node)}>`)
      }
      [argName, formalVar] = nextArg.value
      if (formalVar.is_body_argument) {
        const args = ctx.range_text({
          start: argSpec.start, end: node.attlist[node.attlist.length-1].end
        })
        ctx.token_error(argSpec, `Too many arguments for widget <${elementPath(node)}>: ${args}`)
      }

      actualArgs.set(argName, [
        {kind: 'name', code: argName, source: s.node},
        ": ",
        generate_as_cast_to(ctx, scope, formalVar, s.value.node)
      ])

    } else {
      let passThru: string | undefined
      switch (s.shape) {
        case "identOnly": {
          // ident
          argName = s.name
          is_spread = s.has_three_colon
          passThru = s.name
          break;
        }
        case "labeled": {
          // name=...
          argName = s.name
          is_spread = s.nameNode.has_three_colon
          if (s.value.shape === "ident") {
            passThru = s.value.text
          }
          break;
        }
        case "attelem": {
          // <:yatt:name>..</:yatt:name>
          argName = s.path[s.path.length - 1]
          is_spread = false
          break;
        }
        case "nestLabeled": {
          // [..]=..
          ctx.NIMPL(argSpec)
        }
      }
      if (is_spread) {
        ctx.token_error(argSpec, `spread(:::) is useless here`)
      }
      if (! formalArgs.has(argName)) {
        ctx.token_error(argSpec, `Unknown arg '${argName}'`)
      }
      formalVar = formalArgs.get(argName)!

      if (actualArgs.has(argName)) {
        ctx.token_error(argSpec, `Duplicate argument: ${argName}`)
      }

      if (passThru) {
        const actualVar = scope.lookup(passThru)
        if (! actualVar) {
          ctx.token_error(argSpec, `No such variable ${passThru}`)
        }

        // formalVar escaped and not actualVar escaped
        actualArgs.set(argName, [
          {kind: 'name', code: argName, source: argSpec},
          ": ",
          (isEscapedVariable(formalVar) && !isEscapedVariable(actualVar)
            ? generate_varref_as_escaped(ctx, argSpec, actualVar)
            : {kind: 'name', code: passThru, source: argSpec})
        ])
      }
      else if (argSpec.kind === 'bare' || hasQuotedStringValue(argSpec)) {
        actualArgs.set(argName, [
          {kind: 'name', code: argName, source: argSpec.label},
          ": ",
          generate_as_cast_to(ctx, scope, formalVar, argSpec)
        ])
      }
      else if (argSpec.kind === 'entity') {
        actualArgs.set(argName, [
          {kind: 'name', code: argName},
          ": ",
          generate_as_cast_to(ctx, scope, formalVar, argSpec)
        ])
      }
      else if (isIdentOnly(argSpec) && formalVar.typeName === 'boolean') {
        // 1
        ctx.NIMPL()
      }
      else if (argSpec.kind === "attelem") {
        // <:yatt:name>...</:yatt:name>
        ctx.NIMPL()
      }
      else {
        ctx.token_error(argSpec, `argument '${argName}' requires value expression like '=...'`)
      }
    }
  }

  if (node.children?.length) {
    const BODY_NAME = ctx.session.params.body_argument_name; // XXX: ctx
    if (actualArgs.has(BODY_NAME))
      ctx.token_error(node, `${BODY_NAME} argument is already specified`);
    const BODY = formalArgs.get(BODY_NAME);
    if (BODY != null) {
      switch (BODY.typeName) {
        case "widget": {
          const bodyScope = new VarScope(BODY.widget.argMap, scope);
          const {argDecls} = generate_argdecls(ctx, bodyScope, BODY.widget);
          const bodyProgram = await generate_body(ctx, bodyScope, node.children);
          const conT = ctx.session.params.connectionTypeName
          actualArgs.set(
            BODY_NAME,
            [
              {kind: 'name', code: BODY_NAME},
              ": (",
              {kind: 'name', code: 'CON'},
              `: ${conT}, `,
              argDecls,
              "): void => {",
              bodyProgram,
              "}"
            ]
          )
          break;
        }
        case "html":
        default:
          ctx.NIMPL();
      }
    }
  }
  // console.log(`calleeName: ${calleeWidget.name}, formal: `, formalArgs)
  // console.log(`actual: `, actualArgs)
  for (const [name, formal] of formalArgs.entries()) {
    if (actualArgs.has(name))
      continue;
    if (formal.defaultSpec?.dflag === "!") {
      ctx.token_error(node, `Argument '${name}' is missing`)
    }
  }

  // XXX: node.footer
  return joinAsArray(', ', Array.from(actualArgs.values()))
}

function generate_varref_as_escaped(
  _ctx: WidgetGenContext,
  node: Node, actualVar: Variable
): CodeFragment {
  if (actualVar.is_escaped) {
    return {kind: 'name', code: actualVar.varName, source: node}
  } else {
    return [
      '$yatt.runtime.escape(',
      {kind: 'name', code: actualVar.varName, source: node},
      ')'
    ]
  }
}
