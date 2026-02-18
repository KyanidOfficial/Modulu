export function evaluateShortMessageSpam(shortRatioScaled: number): boolean {
  return shortRatioScaled >= 700;
}
