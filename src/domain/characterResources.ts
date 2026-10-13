import { LIMITE_RECURSO } from "../data/dnd";
import type { Character } from "../types/character";

export type ResourceKey = "hp" | "mp";

/**
 * Positive deltas restore the normal pool up to its maximum without affecting temporary pool.
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
    temp: Math.max(0, Math.trunc(character[key].temp ?? 0)),
  };
}

/**
 * Sets the manual maximum resource directly (Mestre).
 * Also ensures current resource does not exceed the new maximum.
 */
export function setResourceMaximum(
  character: Character,
  key: ResourceKey,
  newMaximum: number,
  limit = LIMITE_RECURSO,
): Character[ResourceKey] {
  const minMax = key === "hp" ? 1 : 0;
  const safeMax = Number.isFinite(newMaximum)
    ? Math.max(minMax, Math.min(limit, Math.trunc(newMaximum)))
    : minMax;
  const currentAtual = Math.max(0, Math.min(safeMax, Math.trunc(character[key].atual)));

  return {
    ...character[key],
    max: safeMax,
    atual: currentAtual,
    temp: Math.max(0, Math.trunc(character[key].temp ?? 0)),
  };
}

/**
 * Sets temporary resource directly (independent pool, bounded 0..200).
 */
export function setTemporaryResource(
  character: Character,
  key: ResourceKey,
  value: number,
  limit = LIMITE_RECURSO,
): Character[ResourceKey] {
  const safeValue = Number.isFinite(value) ? Math.trunc(value) : 0;
  return {
    ...character[key],
    temp: Math.max(0, Math.min(limit, safeValue)),
  };
}

/**
 * Applies an independent delta directly to temporary resource pool.
 */
export function applyTemporaryDelta(
  character: Character,
  key: ResourceKey,
  delta: number,
  limit = LIMITE_RECURSO,
): Character[ResourceKey] {
  const currentTemp = Math.max(0, Math.trunc(character[key].temp ?? 0));
  const amount = Number.isFinite(delta) ? Math.trunc(delta) : 0;
  return {
    ...character[key],
    temp: Math.max(0, Math.min(limit, currentTemp + amount)),
  };
}
