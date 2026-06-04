/**
 * The function `getUpdatedFieldValue` returns the next value if it is different from the current
 * value, otherwise it returns undefined.
 * @param {T | null | undefined} currentValue - The `currentValue` parameter represents the current
 * value of a field, which can be of type `T`, `null`, or `undefined`. It is the value that is
 * currently stored in the field.
 * @param {T | undefined} nextValue - The `nextValue` parameter represents the new value that you want
 * to update the field with.
 */
export const getUpdatedFieldValue = <T>(
  currentValue: T | null | undefined,
  nextValue: T | undefined,
) => (currentValue && currentValue === nextValue ? undefined : nextValue)
