import {Variable} from '../../../declaration/vartype'
export type Printable =
  {kind: "var", variable: Variable} |
  {kind: "text", text: string} |
  {kind: "expr", text: string}
