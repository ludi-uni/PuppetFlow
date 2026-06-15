export function deterministicUnitRandom(seed: number): number {
  const scaled = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return scaled - Math.floor(scaled);
}

function hashInstanceSeed(instanceId: string): number {
  let hash = 0;
  for (let i = 0; i < instanceId.length; i++) {
    hash = (hash * 31 + instanceId.charCodeAt(i)) | 0;
  }
  return hash;
}

export function randomInRange(
  instanceId: string,
  changeIndex: number,
  min: number,
  max: number,
): number {
  const seed = hashInstanceSeed(instanceId) + changeIndex * 97.13;
  return min + deterministicUnitRandom(seed) * (max - min);
}
