import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";
const Progress = React.forwardRef<React.ElementRef<typeof ProgressPrimitive.Root>, React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>>(({
  className,
  value,
  ...props
}, ref) => {});
Progress.displayName = ProgressPrimitive.Root.displayName;
export { Progress };