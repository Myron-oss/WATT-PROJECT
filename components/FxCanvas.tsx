"use client";

import { useEffect, useRef } from "react";
import { mountFx } from "@/lib/fx";

export function FxCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => (ref.current ? mountFx(ref.current) : undefined), []);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[55] h-full w-full" aria-hidden />;
}
