export function re_join(...args: string[]): string {
    return '(?:' + args.join("|") + ')';
}

export function re_lookahead(...args: string[]): string {
    return '(?=' + args.join("|") + ')';
}


