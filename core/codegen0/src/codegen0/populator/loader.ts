#!/usr/bin/env -S deno run -RE

import type {
  YattParams
} from '../../config.ts'
import type {runtime} from '../../yatt.ts'

interface typeof$yatt {
  runtime: typeof runtime
  $public: {[k: string]: DirHandler}
}

interface DirHandler {
  render_(CON: Connection, $params: {[k: string]: any}): Promise<void>
}

interface Connection {
  append(str: string): void;
  appendUntrusted(str?: string | number): void;
  appendRuntimeValue(val: any): void;
}
