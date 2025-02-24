namespace $yatt.runtime {
  export function render_page(pageName: string, params: any) {

    let output = HtmlService.createHtmlOutput()
    let CON = {
      request: {},
      output,
      append: output.append.bind(output),
      appendUntrusted: output.appendUntrusted.bind(output),
      appendRuntimeValue: (val: any) => {
        if (typeof val === "string") {
          output.appendUntrusted(val)
        } else {
          output.append($yatt.runtime.escape(val))
        }
      }
    }

    $yatt.$tmpl[pageName].render_(CON, params)

    return output;
  }
}
