export function escapeAsStringLiteral(text: string): string {
  return "'" + text.replace(
    /['\\\r\n]/g, (chr) => {
      const map = {"\\": "\\\\", "\r": "\\r", "\n": "\\n", "'": "\\'"};
      return map[chr as "'"|"\\"|"\r"|"\n"]
    }
  ) + "'"
}
