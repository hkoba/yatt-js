// A tiny client-side helper, imported by index.client.ts to demonstrate that
// esbuild bundles dependencies (this file is NOT a client entry by itself).
export function renderList(items: {k: string, v: string}[]): HTMLUListElement {
  const ul = document.createElement('ul')
  ul.innerHTML = items.map(it => `<li>${it.k}: ${it.v}</li>`).join('')
  return ul
}
