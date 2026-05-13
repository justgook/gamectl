const THEME_SELECTOR = 'link[data-theme-stylesheet]'

function getThemeStylesheetSource() {
  return document.getElementById('theme-stylesheet')
    || document.querySelector(`head ${THEME_SELECTOR}`)
    || document.querySelector(THEME_SELECTOR)
}

export function ensureThemeStylesheetLink(root, { insertAfter = 'link[href]:last-of-type' } = {}) {
  if (!root?.querySelector) return null

  const source = getThemeStylesheetSource()
  if (!source) return null

  let target = root.querySelector(THEME_SELECTOR)
  const sourceHref = source.getAttribute('href')

  if (target) {
    if (sourceHref && target.getAttribute('href') !== sourceHref) {
      target.setAttribute('href', sourceHref)
    }
    return target
  }

  target = source.cloneNode(false)
  target.removeAttribute('id')
  target.setAttribute('data-theme-stylesheet', '')

  const anchor = root.querySelector(insertAfter)
  if (anchor?.parentNode) {
    anchor.parentNode.insertBefore(target, anchor.nextSibling)
    return target
  }

  if (typeof root.prepend === 'function') {
    root.prepend(target)
  }

  return target
}
