import {AttItem} from 'lrxml'
import {Part, Widget, makeWidget} from './part'

import {BuilderContext} from './context'

import {build_delegate_variable_adder} from './delegate'

import {add_args, ArgAdder} from './addArgs'

export type VarTypeMap = {
  simple: Map<string, SimpleVariableBuilder>;
  nested: Map<string, CallableVariableBuilder | DelayedVariableBuilder>;
}

type SimpleVariableBuilder = {
  kind: "simple", typeName: SimpleVar['typeName'], is_escaped: boolean, is_callable: boolean
}
type CallableVariableBuilder = {
  kind: "callable",
  typeName: string, 
  fun: (ctx: BuilderContext, att: AttItem, argNo: number, varName: string, attlist: AttItem[]) => Variable
}
type DelayedVariableBuilder = {
  kind: "delayed",
  typeName: string,
  fun: (
    ctx: BuilderContext, part: Part, gen: Generator<AttItem>,
    att: AttItem, argNo: number,
    name: string, restName: string[], attlist: AttItem[]
  ) => ArgAdder
}

export type VariableBase = {
  typeName: string
  varName:  string
  argNo?:   number
  defaultSpec?: [DefaultFlag, string]
  attItem?: AttItem
  from_route: boolean
  is_body_argument: boolean
  is_escaped: boolean
  is_callable: boolean
}

export type DefaultFlag = "?" | "|" | "/" | "!"

type TextVar = {typeName: "text"} & VariableBase;
// XXX: AttrVar

type ListVar = {typeName: "list"} & VariableBase;
type ScalarVar = {typeName: "scalar"} & VariableBase;
type BooleanVar = {typeName: "boolean"} & VariableBase;
type HtmlVar = {typeName: "html"} & VariableBase;
type ExprVar = { typeName: "expr"} & VariableBase; // XXX: function, closure, cb
export type SimpleVar = TextVar | ListVar | ScalarVar | BooleanVar |
  HtmlVar | ExprVar

export type WidgetVar = {
  typeName: "widget", is_callable: true, widget: Widget
} & VariableBase;

export type DelegateVar = {
  typeName: "delegate", is_callable: true, widget: Widget,
  delegateVars: Map<string, SimpleVar>
} & VariableBase;

export type Variable = SimpleVar | WidgetVar | DelegateVar

export type VarTypeSpec = {
  typeName: string,
  defaultSpec?: [DefaultFlag, string]
}

export function builtin_vartypemap(): VarTypeMap {
  let tm: VarTypeMap = {simple: new Map, nested: new Map};
  const simple = (typeName: SimpleVar['typeName'], is_escaped: boolean): {
    kind: "simple", typeName: SimpleVar['typeName'],
    is_escaped: boolean, is_callable: false
  } => ({kind: "simple", typeName, is_escaped, is_callable: false});

  tm.simple.set('text', simple("text", false));
  tm.simple.set('html', simple("html", true));

  tm.simple.set('scalar', simple("scalar", false));
  tm.simple.set('value',  tm.simple.get('scalar')!)

  tm.simple.set('list', simple("list", false));

  tm.simple.set('expr', simple("expr", false));
  tm.simple.set('code', tm.simple.get('expr')!);

  tm.simple.set('boolean', simple("boolean", false));
  tm.simple.set('bool',    tm.simple.get('boolean')!);

  tm.nested.set('widget', {
    kind: "callable", typeName: "widget", fun: build_widget_varialbe
  })
  tm.nested.set('code', tm.nested.get('widget')!)

  tm.nested.set('delegate', {
    kind: "delayed", typeName: 'delegate', fun: build_delegate_variable_adder
  })

  return tm
}

export function build_simple_variable(
  ctx: BuilderContext, varName: string, spec: VarTypeSpec,
  {attItem, argNo}: {attItem?: AttItem, argNo?: number}
): SimpleVar
{
  let givenTypeName = spec.typeName;
  let defaultSpec = spec.defaultSpec;
  const is_body_argument = ctx.is_body_argument(varName);

  const rec = ctx.session.varTypeMap.simple.get(givenTypeName)
  if (rec == null)
    ctx.maybe_token_error(attItem, `Unknown type ${givenTypeName} for argument ${varName}`)
 
  const {typeName, is_escaped, is_callable} = rec

  return {
    typeName: typeName as SimpleVar['typeName'], is_escaped, is_callable,
    varName, defaultSpec, attItem, argNo,
      from_route: false, is_body_argument,
  }
}

function build_widget_varialbe(ctx: BuilderContext, att: AttItem, argNo: number, varName: string, attlist: AttItem[]): WidgetVar {
  let widget: Widget = makeWidget(varName, false)
  add_args(ctx, widget, attlist) // XXX: ここで delegate は禁止よね
  return {
    typeName: "widget", widget,
    varName, attItem: att, argNo,
    is_callable: true, from_route: false,
    is_body_argument: ctx.is_body_argument(varName),
    is_escaped: false
  }
}
