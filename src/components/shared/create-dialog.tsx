import type { ComponentType, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CreateDialog({
  title,
  description,
  label,
  icon: Icon,
  children,
  wide = false,
}: {
  title: string;
  description?: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" className="bg-white/90" />}>
        {Icon ? <Icon className="size-4" /> : null}
        {label}
      </DialogTrigger>
      <DialogContent className={wide ? "sm:max-w-3xl" : "sm:max-w-xl"}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="max-h-[72vh] overflow-y-auto pr-1">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
