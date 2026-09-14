/** Map iframe viewport distances to the CSS axes used by a layout operation. */
export function layoutDeltaMapper(element: HTMLElement, includeSelf: boolean) {
  let matrix = new DOMMatrix();
  for (let current: HTMLElement | null = includeSelf ? element : element.parentElement; current; current = current.parentElement) {
    const transform = current.ownerDocument.defaultView!.getComputedStyle(current).transform;
    if (transform !== 'none') matrix = new DOMMatrix(transform).multiply(matrix);
  }
  const inverse = matrix.inverse();
  return (x: number, y: number) => {
    const localX = inverse.a * x + inverse.c * y;
    const localY = inverse.b * x + inverse.d * y;
    return { x: Number.isFinite(localX) ? localX : 0, y: Number.isFinite(localY) ? localY : 0 };
  };
}

export function layoutSize(element: HTMLElement) {
  const css = element.ownerDocument.defaultView!.getComputedStyle(element);
  const px = (property: string) => Number.parseFloat(css.getPropertyValue(property)) || 0;
  const contentBox = css.boxSizing !== 'border-box';
  return {
    width: Number.parseFloat(css.width) || element.offsetWidth - (contentBox ? px('padding-left') + px('padding-right') + px('border-left-width') + px('border-right-width') : 0),
    height: Number.parseFloat(css.height) || element.offsetHeight - (contentBox ? px('padding-top') + px('padding-bottom') + px('border-top-width') + px('border-bottom-width') : 0)
  };
}
