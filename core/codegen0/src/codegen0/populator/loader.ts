#!/usr/bin/env -S deno run -RE

import {
  get_template_declaration
} from '../../declaration/index.ts'

import type {
  CGenBaseSession
} from '../context.ts'

import {generate_populator_for_declentry} from './generate.ts'

import type {runtime} from '../../yatt.ts'

export interface typeof$yatt {
  runtime: typeof runtime
  $public: {[k: string]: DirHandler}
}

export interface DirHandler {
  render_(CON: Connection, $params: {[k: string]: any}): Promise<void>
}

export interface Connection {
  append(str: string): void;
  appendUntrusted(str?: string | number): void;
  appendRuntimeValue(val: any): void;
}

export type LoaderSession = CGenBaseSession & {
  $yatt: typeof$yatt
}

export async function refresh_populator(
  realPath: string, session: LoaderSession
): Promise<DirHandler | undefined> {

  const debug = session.params.debug.declaration

  const entry = await get_template_declaration(session, realPath);

  if (! entry) {
    if (debug) {
      console.log(`No template declaration: `, realPath)
    }
    return
  }

  if (entry.updated) {
    if (debug) {
      console.log(`entry is updated: `, realPath)
    }

    const output = await generate_populator_for_declentry(entry, session);

    const script = output.outputText

    const {populate} = await import(`data:text/typescript,${script}`)

    session.$yatt.$public[realPath] = populate(session.$yatt)
  } else {
    if (debug) {
      console.log(`use cached handler`)
    }
  }

  if (debug) {
    console.log(`session.$yatt.$public: `, session.$yatt.$public)
  }

  return session.$yatt.$public[realPath]
}
