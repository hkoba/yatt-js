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

export interface PopulatorModule {
  populate($yatt: typeof$yatt): HandlerSet
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

export type Populator = {
  $this: HandlerSet, template: TemplateDeclaration
}

export async function refresh_populator(
  realPath: string, session: LoaderSession
): Promise<Populator | undefined> {

  const debug = session.params.debug.declaration ?? 0

  const entry = await get_template_declaration(session, realPath);

  if (! entry) {
    if (debug) {
      console.log(`No template declaration: `, realPath)
    }
    return
  }

  const {runtimeNamespace, modName} = entry.template

  let $this: HandlerSet | undefined
  if (entry.updated) {
    if (debug) {
      console.log(`entry is updated: `, realPath)
    }

    const output = await generate_populator_for_declentry(entry, session);

    if (debug) {
      console.log(`related.length:`, session.output.size)
    }

    for (const [_path, related] of session.output.entries()) {
      await load_output(related, session)
    }

    $this = await load_output({
      runtimeNamespace, modName, output
    }, session)

  } else {
    if (debug) {
      console.log(`use cached handler`)
    }

    $this = ensureRuntimeNamespace(session.$yatt, `$${runtimeNamespace}`)[modName]
  }

  if (debug >= 3) {
    console.log(`session.$yatt.$public: `, session.$yatt.$public)
  }

  if ($this) {
    return {$this, template: entry.template}
  }
}

export async function load_output(
  output: OutputRecord, session: LoaderSession
): Promise<HandlerSet> {

  const {runtimeNamespace, modName} = output

  const script = output.output.outputText

  if ((session.params.debug.codegen ?? 0) >= 2) {
    console.log(`=======================`)
    console.log(`runtimeNamespace:$${runtimeNamespace}, modName=${modName}\n`, script)
  }

  const {populate} = await importTypescript(script)

  const templateFolder = ensureRuntimeNamespace(session.$yatt, `$${runtimeNamespace}`)

  return templateFolder[modName] = populate(session.$yatt)
}

export function ensureRuntimeNamespace($yatt: typeof$yatt, folderName: `$${string}`): HandlerSetFolder {
  $yatt[folderName] ??= {}
  return $yatt[folderName]
}

export async function importTypescript(script: string): Promise<PopulatorModule> {
  return await import(`data:text/typescript;base64,${textToBase64(script)}`)
}

export function textToBase64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text))
}

function bytesToBase64(bytes: Uint8Array): string {
  const binString = Array
    .from(bytes, (byte) => String.fromCodePoint(byte))
    .join("")
  return btoa(binString)
}
