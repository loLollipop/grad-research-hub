"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function SubmitButton({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} className={className} disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {children}
    </Button>
  );
}
