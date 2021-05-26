export function re_join(...args: string[]): string {
    return '(?:' + args.join("|") + ')';
}

