namespace $tmpl.another {
export function render_ (this: typeof $tmpl.another, CON: yatt.runtime.Connection, {BODY}: {BODY?: (CON: yatt.runtime.Connection, {}: {}) => void}) {const $this = this
 CON.append('<h2>another</h2>\n');
}
}
namespace $tmpl.error {
export function render_ (this: typeof $tmpl.error, CON: yatt.runtime.Connection, {msg, BODY}: {msg?: string; BODY?: (CON: yatt.runtime.Connection, {}: {}) => void}) {const $this = this
 CON.append('<h2>Error</h2>\n');
 CON.appendUntrusted(msg); CON.append('\n');
}
}
namespace $tmpl.index {
export function render_ (this: typeof $tmpl.index, CON: yatt.runtime.Connection, {request, BODY}: {request?: any; BODY?: (CON: yatt.runtime.Connection, {}: {}) => void}) {const $this = this
 $this.render_layout(CON, {title: 'Hello world!', BODY: (CON: yatt.runtime.Connection, {}: {}): void => { CON.append('\n');
 CON.append('Are you ok? request=('); CON.appendUntrusted(request); CON.append(')\n');
 CON.append('\n');
}}); CON.append('\n');
}
export function render_layout (this: typeof $tmpl.index, CON: yatt.runtime.Connection, {title, BODY}: {title?: string; BODY?: (CON: yatt.runtime.Connection, {}: {}) => void}) {const $this = this
 CON.append('<body>\n');
 CON.append(' <h2>'); CON.appendUntrusted(title); CON.append('</h2>\n');
 CON.append(' '); BODY && BODY(CON, {}); CON.append('</body>\n');
}
}
