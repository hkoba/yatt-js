#!/bin/zsh

emulate -L zsh

scriptFn=$0:r.ts

realScript=$(readlink -f $scriptFn)

exec deno run -RW $realScript "$@"
