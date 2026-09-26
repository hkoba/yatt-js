import {
  type Node, type AttItem, type AttElement,
  attShape
} from '../../../deps.ts'
import type {WidgetGenContext, Widget} from '../../context.ts'
import {VarScope} from '../../varscope.ts'
import {isEscapedVariable} from '../../../declaration/vartype.ts'
import type {Variable} from '../../../declaration/vartype.ts'
import {generate_argdecls} from '../argdecls.ts'
import {generate_body} from '../body.ts'

import {type CodeFragment, joinAsArray} from '../../codefragment.ts'

import {generate_as_cast_to} from '../../template_context/cast.ts'
import { type TermShape, termShape } from "../../../../../lrxml/src/attlist/shape.ts";

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

    } else {
      let is_spread: boolean | undefined
      switch (s.shape) {
        case "identOnly": {
          // ident
          argName = s.name
          is_spread = s.has_three_colon
          break;
        }
        case "labeled": {
          // name=...
          argName = s.name
          is_spread = s.nameNode.has_three_colon
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
    }

    if (actualArgs.has(argName)) {
      ctx.token_error(argSpec, `Duplicate argument: ${argName}`)
    }

    switch (s.shape) {
      case "identOnly": {
        actualArgs.set(argName, [
          {kind: 'name', code: argName, source: s.node},
          ": ",
          generate_actual_value(ctx, scope, argSpec, formalVar, termShape(s.node))
        ])
        break;
      }
      case "positional":
      case "labeled": {
        actualArgs.set(argName, [
          {kind: 'name', code: argName, source: s.node},
          ": ",
          generate_actual_value(ctx, scope, argSpec, formalVar, s.value)
        ])
        break;
      }
      case "attelem": {
        ctx.NIMPL(argSpec)
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

function generate_actual_value(
  ctx: WidgetGenContext,
  scope: VarScope,
  argSpec: AttElement | AttItem,
  formalVar: Variable,
  value: TermShape
): CodeFragment {
  switch (value.shape) {
    case "ident": {
      if (value.has_three_colon) {
        ctx.token_error(argSpec, `spread(:::) is useless here`)
      }
      const actualVar = scope.lookup(value.text)
      if (! actualVar) {
        ctx.token_error(argSpec, "No such variable ${value.text}")
      }
      if (isEscapedVariable(formalVar) && !isEscapedVariable(actualVar)) {
        return generate_varref_as_escaped(ctx, argSpec, actualVar)
      } else {
        return {kind: "name", code: value.text, source: argSpec}
      }
    }
    case "string":case "entity":
      return generate_as_cast_to(ctx, scope, formalVar, value.node)
    case "nest":
      ctx.NIMPL(argSpec)
  }
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
