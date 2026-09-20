/**
 * Globally disables the browser-native tooltip shown when hovering elements
 * that carry a `title` attribute. The value is preserved on `data-title`
 * so a custom tooltip implementation could consume it later.
 */
function stripTitle(element: Element): void {
  const title = element.getAttribute('title')
  if (title === null) return

  if (title) element.setAttribute('data-title', title)
  element.removeAttribute('title')
}

export function disableNativeTitleTooltips(): void {
  document.querySelectorAll('[title]').forEach(stripTitle)

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        if (mutation.target instanceof Element) stripTitle(mutation.target)
        continue
      }

      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return
        stripTitle(node)
        node.querySelectorAll('[title]').forEach(stripTitle)
      })
    }
  })

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributeFilter: ['title']
  })
}
