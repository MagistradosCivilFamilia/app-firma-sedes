import { redirect } from "next/navigation";
import { maestroAutenticado } from "@/lib/auth";
import ConsolaMaestro from "@/components/ConsolaMaestro";

export const dynamic = "force-dynamic";

export default function MaestroPage() {
  if (!maestroAutenticado()) {
    redirect("/maestro/login");
  }
  return <ConsolaMaestro />;
}
