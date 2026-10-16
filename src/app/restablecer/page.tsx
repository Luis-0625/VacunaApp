import { redirect } from "next/navigation";

/** La recuperación ahora es con código en /recuperar; los enlaces enviados antes llevan allá. */
export default function RestablecerPage() {
  redirect("/recuperar");
}
