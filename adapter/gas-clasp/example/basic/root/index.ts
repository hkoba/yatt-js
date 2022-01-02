namespace $tmpl.another {
export function render_ (this: typeof $tmpl.another, CON: yatt.Connection, {BODY}: {BODY?: (CON: yatt.Connection, {}: {}) => void}) {const $this = this
 CON.append('<h2>another</h2>\n');
}
}
namespace $tmpl.error {
export function render_ (this: typeof $tmpl.error, CON: yatt.Connection, {msg, BODY}: {msg?: string; BODY?: (CON: yatt.Connection, {}: {}) => void}) {const $this = this
 CON.append('<h2>Error</h2>\n');
 CON.appendUntrusted(msg); CON.append('\n');
}
}
namespace $tmpl.index {
export function render_ (this: typeof $tmpl.index, CON: yatt.Connection, {BODY}: {BODY?: (CON: yatt.Connection, {}: {}) => void}) {const $this = this
 $this.render_layout(CON, {title: 'Hello world!', BODY: (CON: yatt.Connection, {}: {}): void => { CON.append('\n');
 CON.append('<form>\n');
 CON.append('foo: <input name="foo" value="'); CON.append($yatt.param.apply(CON, ['foo'])); CON.append('">\n');
 CON.append('<input type=submit>\n');
 CON.append('</form>\n');
 CON.append('\n');
for (const x of [3,4,5]) { CON.append('    <li>'); CON.appendUntrusted(x); CON.append('</li>\n');
} CON.append('\n');
}}); CON.append('\n');
}
export function render_layout (this: typeof $tmpl.index, CON: yatt.Connection, {title, BODY}: {title?: string; BODY?: (CON: yatt.Connection, {}: {}) => void}) {const $this = this
 CON.append('<body>\n');
 CON.append(' <h2>'); CON.appendUntrusted(title); CON.append('</h2>\n');
 CON.append(' '); BODY && BODY(CON, {}); CON.append('</body>\n');
}
}
