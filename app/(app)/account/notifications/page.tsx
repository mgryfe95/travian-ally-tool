import { redirect } from "next/navigation";

/** Alte Adresse (Lesezeichen) → Seite „App“. */
export default function OldNotificationsPage() {
  redirect("/app");
}
