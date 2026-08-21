"use client";

import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // instalação como PWA é um extra, não deve quebrar o app se falhar
      });
    }
  }, []);

  return null;
}
