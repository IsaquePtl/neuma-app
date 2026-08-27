"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/** Mostra um toast uma vez ao montar (ex.: após redirect com query de sucesso). */
export function FlashToast({
  message,
  tone = "success",
}: {
  message: string;
  tone?: "success" | "error";
}) {
  useEffect(() => {
    if (tone === "error") toast.error(message);
    else toast.success(message);
  }, [message, tone]);

  return null;
}
