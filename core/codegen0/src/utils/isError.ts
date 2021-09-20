export function isError<T, E>(value: {ok: T} | {err: string, value: E})
: value is {err: string, value: E} {
  return (value as {err: string, value: E}).err !== undefined
}
