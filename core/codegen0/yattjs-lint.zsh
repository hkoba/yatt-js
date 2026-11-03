#!/bin/zsh

emulate -L zsh

scriptFn=$(readlink -f $0)
tsFn=$scriptFn:h/src/bin/$scriptFn:t:r.ts

exec deno run -RE $tsFn "$@"
