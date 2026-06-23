import { redirect } from "next/navigation";
import { maestroAutenticado } from "@/lib/auth";
import CrearProceso from "@/components/CrearProceso";

export const dynamic = "force-dynamic";

export default function Page() {
  if (!maestroAutenticado()) redirect("/maestro/login");
  return <CrearProceso />;
}
