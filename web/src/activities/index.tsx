import type { Activity } from "@/lib/types";
import type { ActivityProps } from "./types";
import { Choice } from "./Choice";
import { Counting } from "./Counting";
import { Arithmetic } from "./Arithmetic";
import { Matching } from "./Matching";
import { Tracing } from "./Tracing";
import { DragDrop } from "./DragDrop";

// Registry mapping each content activity type to its typed renderer.
export const ACTIVITY_RENDERERS: Record<Activity, (props: ActivityProps) => JSX.Element | null> = {
  "letter-recognition": Choice,
  "multiple-choice": Choice,
  counting: Counting,
  arithmetic: Arithmetic,
  matching: Matching,
  tracing: Tracing,
  "drag-drop": DragDrop,
};

export type { ActivityProps };
