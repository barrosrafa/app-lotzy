import type { RandomSource } from "../ports/RandomSource.js";
export class GameGenerator {
  constructor(private readonly random: RandomSource) {}

  weightedDraw(
    size: number,
    pool: readonly number[],
    weights: ReadonlyMap<number, number> | Record<number, number>,
  ): number[] {
    if (size < 0 || size > pool.length)
      throw new RangeError(
        `Cannot draw ${size} numbers from a pool of ${pool.length}.`,
      );
    const remaining = [...pool];
    const selected: number[] = [];
    const getWeight = (number: number) => {
      const weight = weights instanceof Map
        ? weights.get(number)
        : (weights as Record<number, number>)[number];
      return Number.isFinite(weight) && (weight ?? 0) > 0 ? weight! : 0;
    };
    for (let index = 0; index < size; index += 1) {
      const total = remaining.reduce((sum, number) => sum + getWeight(number), 0);
      const selectedIndex = total <= 0
        ? this.random.nextInt(0, remaining.length)
        : this.weightedIndex(remaining, total, getWeight);
      selected.push(remaining.splice(selectedIndex, 1)[0]);
    }
    return selected.sort((a, b) => a - b);
  }

  private weightedIndex(
    values: readonly number[],
    total: number,
    getWeight: (number: number) => number,
  ): number {
    const target = (this.random.nextInt(0, 1_000_000) / 1_000_000) * total;
    let cumulative = 0;
    for (let index = 0; index < values.length; index += 1) {
      cumulative += getWeight(values[index]);
      if (target < cumulative) return index;
    }
    return values.length - 1;
  }

  draw(size: number, pool: readonly number[]): number[] {
    if (size < 0 || size > pool.length)
      throw new RangeError(
        `Cannot draw ${size} numbers from a pool of ${pool.length}.`,
      );
    const scratch = [...pool];
    for (let i = 0; i < size; i += 1) {
      const j = this.random.nextInt(i, scratch.length);
      [scratch[i], scratch[j]] = [scratch[j], scratch[i]];
    }
    return scratch.slice(0, size).sort((a, b) => a - b);
  }
}
