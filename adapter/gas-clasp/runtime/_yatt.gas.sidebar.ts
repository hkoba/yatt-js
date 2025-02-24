namespace $yatt.runtime {
  export function show_sidebar(pageName: string, params: any) {
    try {
      const output = $yatt.runtime.render_page(pageName, params)
      SpreadsheetApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
        .showSidebar(output);
    } catch (e) {
      const diag = HtmlService.createHtmlOutput()
      diag.append(`Error: `)
      diag.append(e.message)
      SpreadsheetApp.getUi()
        .showSidebar(diag);
    }
  }

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
