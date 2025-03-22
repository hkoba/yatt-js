#!/usr/bin/env -S deno run -RE

import type {
  YattParams
} from '../../config.ts'

type LoaderSession = {
  params: YattParams
}

// function ensure_declaration_is_loaded(
//   session: LoaderSession
// )
