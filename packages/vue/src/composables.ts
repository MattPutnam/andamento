import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from "vue";
import { createLayout, fitCount, type FitOptions, type Layout, type LayoutOptions } from "@andamento/core";

/** A computed value worked out again only when `key` changes. */
function byKey<T>(key: () => string, make: () => T): ComputedRef<T> {
  let lastKey: string | undefined, last: T;
  return computed(() => {
    const k = key();
    if (k !== lastKey) {
      last = make();
      lastKey = k;
    }
    return last;
  });
}

/**
 * A layout from options (a ref, a getter or a plain object), worked out again only when
 * they change by value.
 */
export function useTileLayout(options: MaybeRefOrGetter<LayoutOptions>): ComputedRef<Layout> {
  return byKey(() => JSON.stringify(toValue(options)), () => createLayout(toValue(options)));
}

/** A layout whose tiles are sized to give about `count` usable cells (see `fitCount`). */
export function useFitCount(options: MaybeRefOrGetter<LayoutOptions>, count: MaybeRefOrGetter<number>, fit: FitOptions = {}): ComputedRef<Layout> {
  return byKey(
    () => JSON.stringify([toValue(options), toValue(count)]),
    () => fitCount(toValue(options), toValue(count), fit).layout,
  );
}
