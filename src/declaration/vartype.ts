import {AttItem} from 'lrxml-js'
import {Widget} from './part'

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

export type DefaultFlag = "?" | "|" | "/"

type TextVar = {typeName: "text"} & VariableBase;
type ListVar = {typeName: "list"} & VariableBase;
type ScalarVar = {typeName: "scalar"} & VariableBase;
type BooleanVar = {typeName: "boolean"} & VariableBase;
type HtmlVar = {typeName: "html", is_escaped: true} & VariableBase;
type ExprVar = { typeName: "expr", is_callable: true} & VariableBase;
export type SimpleVar = TextVar | ListVar | ScalarVar | BooleanVar | HtmlVar | ExprVar

export type WidgetVar = {
  typeName: "widget", is_callable: true, widget: Widget
} & VariableBase;

export type DelegateVar = {
  typeName: "delegate", is_callable: true, widget: Widget,
  delegateVars: Map<string, SimpleVar>
} & VariableBase;

export type Variable = SimpleVar | WidgetVar | DelegateVar

export type VarTypeSpec = { typeName: string, defaultSpec?: [DefaultFlag, string] }
