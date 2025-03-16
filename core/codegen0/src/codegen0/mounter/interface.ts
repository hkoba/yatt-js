#!/usr/bin/env -S deno run -RE

import type {
  TemplateDeclaration
} from '../../declaration/index.ts'


import {
  type CGenSession, CodeGenContextClass, finalize_codefragment
} from '../context.ts'

import type {CodeFragment} from '../codefragment.ts'

import {generate_widget_signature} from '../widget/generate.ts'

export function generate_template_interface(
  template: TemplateDeclaration,
  session: CGenSession
): CodeFragment[] {

  const program: CodeFragment[] = []

  program.push(`interface typeof$yatt {
  $public: typeof$yatt$public
}

interface typeof$yatt$public {
  index: typeof$yatt$public$index
}

interface Connection {
  append(str: string): void;
  appendUntrusted(str?: string | number): void;
  appendRuntimeValue(val: any): void;
}
`)

  program.push(`export interface typeof$yatt$public$index {\n`)

  for (const part of template) {
    switch (part.kind) {
      case "widget": {
        const ctx = new CodeGenContextClass(template, part, session);
        const {signature} = generate_widget_signature(ctx)
        program.push(signature, "\n")
        break;
      }
    }
  }

  program.push('}\n')

  return program
}
