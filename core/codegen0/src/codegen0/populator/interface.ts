#!/usr/bin/env -S deno run -RE

import type {
  TemplateDeclaration
} from '../../declaration/index.ts'


import {
  type TargetedCGenSession, CodeGenContextClass
} from '../context.ts'

import type {CodeFragment} from '../codefragment.ts'

import {generate_widget_signature} from '../widget/generate.ts'

export function generate_reference_interface(
  session: TargetedCGenSession
): CodeFragment[] {

  const program: CodeFragment[] = []

  const importTree = gatherImports(session)

  program.push(`interface typeof$yatt {\n`);

  for (const [folder, templateList] of Object.entries(importTree)) {
    program.push(` \$${folder}: {\n`);
    for (const template of templateList) {
      program.push(`    ${template.modName}: {\n`)
      for (const [kind, name] of template.partOrder) {
        switch (kind) {
          case "widget": {
            const part = template.partMap[kind].get(name)!
            const ctx = new CodeGenContextClass(template, part, session);
            const {signature} = generate_widget_signature(ctx)
            program.push(`      `, signature, ";\n")
            break;
          }
        }
      }
      program.push(`    }\n`)
    }
    program.push(`  }\n`);
  }
  program.push('};\n')

  return program
}

function gatherImports(session: TargetedCGenSession) {
  const result: {[k: string]: TemplateDeclaration[]} = {}
  for (const template of Object.values(session.importDict)) {
    result[template.folder] ??= []
    result[template.folder].push(template)
  }
  return result
}
