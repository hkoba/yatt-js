#!/usr/bin/env -S deno run -WRE

/// <reference lib="deno.ns" />

//
// Migration tool: gas-clasp の runtime 名前空間規約を
// 旧 prefix 形 → 新 suffix 形へ書き換える。
//
//   $yatt.$public        -> $yatt.public$
//   $yatt.$<folder>      -> $yatt.<folder>$
//   $yatt.$staticMap     -> $yatt.staticMap$
//   export const $staticMap -> export const staticMap$
//
// 変更しないもの（`$` 前置メンバを持たない）:
//   $yatt.runtime.* / $yatt.<entity>(...) / namespace $yatt / namespace $yatt.runtime
//
// 使い方:
//   migrate.ts [--dry-run] [root ...]      (root 既定: ./root)
//
// 冪等性: 規則は `$yatt.$x`（x は非 `$` 始まり）と `export const $staticMap` のみに
// 一致するため、変換後の suffix 形には再度マッチしない。再実行しても二重変換されない。
//

import {glob} from 'npm:glob'
import * as Path from 'node:path'
import {readFileSync, writeFileSync} from 'node:fs'

type Rule = {re: RegExp, replacement: string, desc: string}

// 注: `\w` は `$` を含まないので、`$yatt.$public` の `public` 部分のみを捕捉する。
//     変換後 `$yatt.public$` には `.$` が無いため再マッチしない（冪等）。
const RULES: Rule[] = [
  {
    re: /\$yatt\.\$(\w+)/g,
    replacement: '$yatt.$1$',
    desc: '$yatt.$<name> -> $yatt.<name>$',
  },
  {
    re: /\bexport const \$staticMap\b/g,
    replacement: 'export const staticMap$',
    desc: 'export const $staticMap -> export const staticMap$',
  },
]

function migrateText(text: string): string {
  let out = text
  for (const {re, replacement} of RULES) {
    out = out.replace(re, replacement)
  }
  return out
}

function showDiff(fn: string, before: string, after: string): number {
  const a = before.split('\n')
  const b = after.split('\n')
  let changed = 0
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      changed++
      console.log(`  ${fn}:${i + 1}`)
      console.log(`    - ${a[i]}`)
      console.log(`    + ${b[i]}`)
    }
  }
  return changed
}

function migrate(roots: string[], dryRun: boolean): void {
  let totalFiles = 0
  let totalChangedFiles = 0
  let totalChangedLines = 0

  for (const root of roots) {
    const fileList = glob.sync('**/*.ts', {root, cwd: root, nodir: true})
    for (const rel of fileList) {
      const fn = Path.join(root, rel)
      const before = readFileSync(fn, {encoding: 'utf-8'})
      const after = migrateText(before)
      totalFiles++
      if (after === before) {
        continue
      }
      totalChangedFiles++
      if (dryRun) {
        console.log(`[dry-run] would update ${fn}`)
        totalChangedLines += showDiff(fn, before, after)
      } else {
        writeFileSync(fn, after)
        console.log(`Updated ${fn}`)
        totalChangedLines += showDiff(fn, before, after)
      }
    }
  }

  console.log(
    `\n${dryRun ? '[dry-run] ' : ''}` +
    `scanned ${totalFiles} file(s), ` +
    `${totalChangedFiles} changed, ${totalChangedLines} line(s).`
  )
  if (dryRun && totalChangedFiles) {
    console.log(`(dry-run のため書き込みはしていません。確認後 --dry-run を外して再実行)`)
  }
}

if (import.meta.main) {
  const args = [...Deno.args]
  let dryRun = false
  const roots: string[] = []
  for (const a of args) {
    if (a === '--dry-run' || a === '-n') {
      dryRun = true
    } else if (a === '--help' || a === '-h') {
      console.log(`Usage: migrate.ts [--dry-run] [root ...]   (root default: ./root)`)
      Deno.exit(0)
    } else {
      roots.push(a)
    }
  }
  if (! roots.length) {
    roots.push('./root')
  }
  migrate(roots, dryRun)
}
