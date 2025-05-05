import type { DeclState } from "../declaration/context.ts";
import type { CGenRequestSession } from "./context.ts";
import { generate_module_for_declentry } from "./module/generate.ts";
import { generate_namespace_for_declentry } from "./namespace/generate.ts";
import { generate_populator_for_declentry } from "./populator/generate.ts";

import { IndentScope } from './context.ts'

export async function ensure_generated(
  entry: DeclState,
  session: CGenRequestSession
): Promise<void> {

  // console.log(`generating ${entry.template.path}`)
  using _top = new IndentScope(session, 0)

  const output = await generate_for_declentry(entry, session);
  session.output.push({
    folder: entry.template.folder,
    modName: entry.template.modName,
    output
  })
}

export async function generate_for_declentry(
  entry: DeclState,
  session: CGenRequestSession
): Promise<{outputText: string, sourceMapText: string}> {
  switch (session.cgenStyle) {
    case 'populator': {
      return await generate_populator_for_declentry(entry, session)
    }
    case 'module': {
      return await generate_module_for_declentry(entry, session);
    }
    case 'namespace': {
      return await generate_namespace_for_declentry(entry, session);
    }
  }
}
