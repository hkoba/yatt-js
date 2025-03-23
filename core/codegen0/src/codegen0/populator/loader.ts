#!/usr/bin/env -S deno run -RE

import {
  get_public_template_declaration,
  get_template_declaration
} from '../../declaration/index.ts'

import type {
  CGenBaseSession
} from '../context.ts'

import {
  type PathSpec,
  pathPairFromSpec
} from '../../path.ts'

import {generate_populator_for_declentry} from './generate.ts'

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

export type LoaderSession = CGenBaseSession & {
  $yatt: typeof$yatt
}

export type RefreshOptions = {
  private?: boolean
}

export async function refresh_populator(
  pathSpec: PathSpec, session: LoaderSession, options?: RefreshOptions
): Promise<DirHandler | undefined> {

  const debug = session.params.debug.declaration

  const pathPair = pathPairFromSpec(pathSpec)

  const entry = options?.private
    ? await get_template_declaration(session, pathSpec)
    : await get_public_template_declaration(session, pathSpec);

  if (! entry) {
    if (debug) {
      console.log(`No template declaration: `, pathSpec)
    }
    return
  }

  if (entry.updated) {
    if (debug) {
      console.log(`entry is updated: `, pathPair)
    }

    const output = await generate_populator_for_declentry(entry, session);

    const script = output.outputText

    const {populate} = await import(`data:text/typescript,${script}`)

    session.$yatt.$public[pathPair.virtPath] = populate(session.$yatt)
  } else {
    if (debug) {
      console.log(`use cached handler`)
    }
  }

  if (debug) {
    console.log(`session.$yatt.$public: `, session.$yatt.$public)
  }

  return session.$yatt.$public[pathPair.virtPath]
}
