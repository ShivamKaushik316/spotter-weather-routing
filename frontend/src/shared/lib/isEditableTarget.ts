const EDITABLE_INPUT_TYPES = new Set(["text", "search", "number", "datetime-local", "email"]);

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true;
  return target instanceof HTMLInputElement && EDITABLE_INPUT_TYPES.has(target.type);
}
