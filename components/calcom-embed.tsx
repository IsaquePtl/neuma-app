"use client";

import { useEffect } from "react";
import Cal, { getCalApi } from "@calcom/embed-react";

export function CalEmbed({
  calLink = "isaque-portilho-nutfa9",
}: {
  calLink?: string;
}) {
  useEffect(() => {
    (async () => {
      const cal = await getCalApi();
      cal("ui", {
        theme: "dark",
        hideEventTypeDetails: false,
        layout: "month_view",
      });
    })();
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border">
      <Cal
        calLink={calLink}
        style={{ width: "100%", height: "620px", overflow: "scroll" }}
        config={{ theme: "dark", layout: "month_view" }}
      />
    </div>
  );
}
