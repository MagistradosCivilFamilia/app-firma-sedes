import { redirect } from "next/navigation";
import { maestroAutenticado } from "@/lib/auth";
import GestionProceso from "@/components/GestionProceso";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  if (!maestroAutenticado()) redirect("/maestro/login");
  return <GestionProceso id={params.id} />;
}
