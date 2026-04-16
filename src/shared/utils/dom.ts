const SVG_NS = 'http://www.w3.org/2000/svg';

export function createStyleElement(cssText: string): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = cssText;
  return style;
}

export function createSvgNode<K extends keyof SVGElementTagNameMap>(
  tagName: K,
  attributes: Record<string, string> = {},
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tagName);

  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }

  return element;
}
