/** A UI action bound to a `data-action` / `data-change` / `data-enter` attribute. */
export type Action = (element: HTMLElement, event: Event) => void | Promise<void>;
export type ActionMap = Record<string, Action>;

/** The `data-i` index carried by list buttons. */
export const indexOf = (element: HTMLElement): number => Number(element.dataset.i);
