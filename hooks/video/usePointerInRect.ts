// Tells whether the mouse pointer is inside the given rectangle.
import { useEffect, useState } from 'react';

export function usePointerInRect(rect: DOMRect | null): boolean {
  const [inside, setInside] = useState(false);

  useEffect(() => {
    if (!rect) {
      setInside(false);
      return;
    }

    const onMove = (e: MouseEvent) => {
      setInside(
        e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom,
      );
    };

    document.addEventListener('mousemove', onMove, true);
    return () => document.removeEventListener('mousemove', onMove, true);
  }, [rect]);

  return inside;
}
