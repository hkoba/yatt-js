#!/usr/bin/env -S deno run -RE

import {
  get_template_declaration,
  type TemplateDeclaration,
  type OutputRecord
} from '../../declaration/index.ts'

import type {
  CGenRequestSession
} from '../context.ts'

import {generate_populator_for_declentry} from './generate.ts'

import type {runtime} from '../../yatt.ts'

export interface typeof$yatt {
  runtime: typeof runtime;
  [key: `$${string}`]: HandlerSetFolder
}

export type HandlerSetFolder = {
  [key: string]: HandlerSet
}

export type HandlerSet = {
  [key: `render_${string}`]: Renderer
}

// XXX: more precise type
export type Renderer = (CON: Connection, $params: {[k: string]: any}) => Promise<void>;

export interface Connection {
  append(str: string): void;
  appendUntrusted(str?: string | number): void;
  appendRuntimeValue(val: any): void;
}

export type LoaderSession = CGenRequestSession & {
  $yatt: typeof$yatt
}

export async function refresh_populator(
  realPath: string, session: LoaderSession
): Promise<{$this: HandlerSet, template: TemplateDeclaration} | undefined> {

  const debug = session.params.debug.declaration

  const entry = await get_template_declaration(session, realPath);

  if (! entry) {
    if (debug) {
      console.log(`No template declaration: `, realPath)
    }
    return
  }

  const {folder, modName} = entry.template

  let $this: HandlerSet | undefined
  if (entry.updated) {
    if (debug) {
      console.log(`entry is updated: `, realPath)
    }

    const output = await generate_populator_for_declentry(entry, session);

    if (debug) {
      console.log(`related.length:`, session.output.length)
    }

    for (const related of session.output) {
      await load_output(related, session)
    }

    $this = await load_output({
      folder, modName, output
    }, session)

  } else {
    if (debug) {
      console.log(`use cached handler`)
    }

    $this = ensure_folder(session.$yatt, `$${folder}`)[modName]
  }

  if (debug) {
    console.log(`session.$yatt.$public: `, session.$yatt.$public)
  }

  if ($this) {
    return {$this, template: entry.template}
  }
}

export async function load_output(
  output: OutputRecord, session: LoaderSession
): Promise<HandlerSet> {

  const {folder, modName} = output

  const script = output.output.outputText

  if ((session.params.debug.codegen ?? 0) >= 2) {
    console.log(`=======================`)
    console.log(`folder:$${folder}, modName=${modName}\n`, script)
  }

  const {populate} = await import(`data:text/typescript,${script}`)

  const templateFolder = ensure_folder(session.$yatt, `$${folder}`)

  return templateFolder[modName] = populate(session.$yatt)
}

function ensure_folder($yatt: typeof$yatt, folderName: `$${string}`): HandlerSetFolder {
  $yatt[folderName] ??= {}
  return $yatt[folderName]
}
