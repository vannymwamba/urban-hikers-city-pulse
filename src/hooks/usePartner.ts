// hooks/usePartner.ts
// Reads ?partner= from the URL, fetches the partner doc from Firestore,
// and returns it. Zero side-effects on the rest of the app.

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export interface PartnerDoc {
  id: string;
  name: string;
  short_name: string;       // e.g. "21c Hotel" — shown in strip
  logo_url: string | null;  // Storage URL, null = use initials fallback
  logo_initials: string;    // e.g. "21C" — fallback when no logo
  accent_color: string;     // hex, e.g. "#C8A800" — used in strip bg tint
  hub_id: string;           // which hub this partner anchors to
  label: string;            // e.g. "Guest Guide" | "Partner Venue"
  active: boolean;
}

interface UsePartnerResult {
  partner: PartnerDoc | null;
  loading: boolean;
}

export function usePartner(): UsePartnerResult {
  const [partner, setPartner] = useState<PartnerDoc | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const partnerId = params.get("partner");
    if (!partnerId) return;

    setLoading(true);
    getDoc(doc(db, "partners", partnerId))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as Omit<PartnerDoc, "id">;
          if (data.active) {
            setPartner({ id: snap.id, ...data });
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return { partner, loading };
}
