export function readChartToken(token: string, element: HTMLElement): string {
  const value = getComputedStyle(element).getPropertyValue(token).trim()
  if (!value) throw new Error(`Missing chart token: ${token}`)
  return value
}
export function chartColors(element: HTMLElement) {
  const read = (name: string) => readChartToken(`--chart-${name}`, element)
  return {
    background: read('background'), text: read('text'), grid: read('grid'), crosshair: read('crosshair'),
    up: read('up'), down: read('down'), volumeUp: read('volume-up'), volumeDown: read('volume-down'),
    ma: [read('ma-5'), read('ma-10'), read('ma-20')],
    font: readChartToken('--font-code', element),
  }
}
