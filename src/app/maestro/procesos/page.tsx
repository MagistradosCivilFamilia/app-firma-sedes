import { redirect } from "next/navigation";
import { maestroAutenticado } from "@/lib/auth";
import HistorialProcesos from "@/components/HistorialProcesos";

export const dynamic = "force-dynamic";

export default function Page() {
  if (!maestroAutenticado()) redirect("/maestro/login");
  return <HistorialProcesos />;
}
