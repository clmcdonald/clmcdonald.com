import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Keyboard support for the modal dialogs: moves focus into the dialog on
 * mount, keeps Tab and Shift+Tab cycling inside it, and hands focus back to
 * whatever was focused before on unmount. Returns the ref for the dialog.
 *
 * The element marked `data-autofocus` gets focus first, so the primary action
 * (not merely the first button in DOM order) is what a keyboard user lands on.
 */
export function useFocusTrap<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // A plain <div> is not focusable; -1 keeps it out of the tab order while
    // still allowing it to be focused as a last resort.
    if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1');

    const focusable = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => element.getAttribute('aria-hidden') !== 'true'
      );

    const preferred = node.querySelector<HTMLElement>('[data-autofocus]');
    (preferred ?? focusable()[0] ?? node).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        node.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = active !== null && node.contains(active);

      if (event.shiftKey && (active === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    };

    node.addEventListener('keydown', onKeyDown);
    return () => {
      node.removeEventListener('keydown', onKeyDown);
      // Only restore if that element is still on the page — the card that was
      // focused when the dialog opened is often gone by the time it closes.
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, []);

  return ref;
}
