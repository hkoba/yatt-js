
import { Part } from './part'

export type Action = Part & {
  kind: "action"
}
