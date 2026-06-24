// Client-side (browser) TypeScript entry point. Recognized by the `.client.ts`
// extension, bundled by esbuild to ./_dist/index.js and referenced from
// index.yatt via <script src="/_dist/index.js">.
import { renderList } from './dom.ts'

function init(): void {
  const data = [{k: 'alpha', v: '1'}, {k: 'beta', v: '2'}]
  const app = document.getElementById('app')
  if (app) app.appendChild(renderList(data))
}

init()
