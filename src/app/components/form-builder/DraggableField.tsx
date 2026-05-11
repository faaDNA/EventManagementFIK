import React, { useRef, useEffect } from "react";
import { useDrag, useDrop } from "react-dnd";

const ITEM_TYPE = "FORM_FIELD";

// ── Global Auto-Scroll ──
export function GlobalAutoScroll() {
  const frameRef = useRef<number>(0);
  const mouseY = useRef(-1);
  const dragging = useRef(false);

  useEffect(() => {
    const onDragStart = () => { dragging.current = true; mouseY.current = -1; startTick(); };
    const onDragEnd = () => { dragging.current = false; stopTick(); };
    const onDragOver = (e: DragEvent) => { mouseY.current = e.clientY; };
    const onDrop = () => { dragging.current = false; stopTick(); };

    const EDGE = 120;
    const MAX_SPEED = 14;

    const tick = () => {
      if (!dragging.current) return;
      const y = mouseY.current;
      const vh = window.innerHeight;
      if (y >= 0) {
        if (y < EDGE) {
          window.scrollBy(0, -Math.max(2, Math.round(MAX_SPEED * (1 - y / EDGE))));
        } else if (y > vh - EDGE) {
          window.scrollBy(0, Math.max(2, Math.round(MAX_SPEED * ((y - (vh - EDGE)) / EDGE))));
        }
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    const startTick = () => { stopTick(); frameRef.current = requestAnimationFrame(tick); };
    const stopTick = () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); frameRef.current = 0; };

    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("dragend", onDragEnd);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("dragend", onDragEnd);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
      stopTick();
    };
  }, []);

  return null;
}

// ── Draggable Field (ID-based, bukan index-based) ──
interface DraggableFieldProps {
  id: string;
  moveField: (dragId: string, hoverId: string, placeBefore: boolean) => void;
  children: React.ReactNode;
}

export function DraggableField({ id, moveField, children }: DraggableFieldProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: ITEM_TYPE,
    item: () => ({ id }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: ITEM_TYPE,
    hover(item: { id: string }, monitor) {
      if (!ref.current || item.id === id) return;
      const rect = ref.current.getBoundingClientRect();
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientY = clientOffset.y - rect.top;
      const cardHeight = rect.bottom - rect.top;
      const midpoint = cardHeight / 2;
      moveField(item.id, id, hoverClientY < midpoint);
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  });

  preview(drop(ref));

  return (
    <div
      ref={ref}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className={`transition-opacity ${isOver ? "ring-2 ring-[#ff6900]/30 rounded-2xl" : ""}`}
    >
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<any>, { dragRef: drag })
          : child
      )}
    </div>
  );
}

// ── Drop zone untuk section (pindah antar section) ──
interface SectionDropZoneProps {
  sectionId: string;
  onDropField: (fieldId: string, sectionId: string) => void;
  children: React.ReactNode;
  isEmpty: boolean;
}

export function SectionDropZone({ sectionId, onDropField, children, isEmpty }: SectionDropZoneProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isOver, canDrop }, drop] = useDrop({
    accept: ITEM_TYPE,
    drop(item: { id: string }) {
      onDropField(item.id, sectionId);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  drop(ref);

  return (
    <div ref={ref} className="relative min-h-[1px]">
      {children}
      {isEmpty && (
        <div className={`flex items-center justify-center rounded-xl border-2 border-dashed py-8 transition-all ${
          isOver && canDrop
            ? "border-[#ff6900] bg-[#ff6900]/5 text-[#ff6900]"
            : "border-border/50 text-muted-foreground/40"
        }`}>
          <p className="text-sm font-medium">
            {isOver && canDrop ? "Lepaskan di sini" : "Seret pertanyaan ke sini"}
          </p>
        </div>
      )}
    </div>
  );
}
