import type { Character } from "../types/character";

export type ResourceKey = "hp" | "mp";

/**
 * Positive deltas restore the normal pool up to its derived maximum.
 * Negative deltas consume temporary resources before normal current resources.
 */
export function applyResourceDelta(
  character: Character,
  key: ResourceKey,
  delta: number,
  maximum: number,
): Character[ResourceKey] {
  const resource = character[key];
  const safeMax = Math.max(0, Math.trunc(maximum));
  const safeCurrent = Math.max(
    0,
    Math.min(safeMax, Math.trunc(resource.atual)),
  );
  const safeTemporary = Math.max(0, Math.trunc(resource.temp ?? 0));

  if (!Number.isFinite(delta)) {
    return {
      ...resource,
      atual: safeCurrent,
      max: safeMax,
      temp: safeTemporary,
    };
  }

  const amount = Math.trunc(delta);

  if (amount < 0) {
    const cost = Math.abs(amount);
    const temporaryConsumed = Math.min(safeTemporary, cost);
    const remainingCost = cost - temporaryConsumed;

    return {
      ...resource,
      atual: Math.max(0, safeCurrent - remainingCost),
      max: safeMax,
      temp: safeTemporary - temporaryConsumed,
    };
  }

  return {
    ...resource,
    atual: Math.min(safeMax, safeCurrent + amount),
    max: safeMax,
    temp: safeTemporary,
  };
}

/**
 * Sets the normal current value directly without consuming temporary resources.
 */
export function setResourceCurrent(
  character: Character,
  key: ResourceKey,
  value: number,
  maximum: number,
): Character[ResourceKey] {
  const safeMax = Number.isFinite(maximum)
    ? Math.max(0, Math.trunc(maximum))
    : 0;
  const safeValue = Number.isFinite(value) ? Math.trunc(value) : 0;

  return {
    ...character[key],
    atual: Math.max(0, Math.min(safeMax, safeValue)),
    max: safeMax,
  };
}
