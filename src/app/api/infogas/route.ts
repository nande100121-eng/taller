// Proxy del consultor de placa de INFOGAS (https://apivh.infogas.com.pe/api/search).
// El navegador no puede llamar directamente al API externo por CORS, así que la
// consulta se hace desde el servidor Next.js. Devuelve ProximaRevAnual (Chip) y
// ProximoVencCilindro (Quinquenal). Se envía la placa SIN guion (el API rechaza
// "AUH-440" y responde solo con "AUH440").
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const INFOGAS_URL = "https://apivh.infogas.com.pe/api/search";

async function consultInfogas(plateRaw: string) {
  const plate = String(plateRaw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!plate) {
    return NextResponse.json({ status: "Error", message: "Placa requerida" }, { status: 400 });
  }
  const form = new URLSearchParams();
  form.append("plate", plate);
  const res = await fetch(INFOGAS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
    body: form.toString(),
  });
  const data = await res.json();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    return consultInfogas(body?.plate || "");
  } catch (err) {
    return NextResponse.json({ status: "Error", message: String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    return consultInfogas(req.nextUrl.searchParams.get("plate") || "");
  } catch (err) {
    return NextResponse.json({ status: "Error", message: String(err) }, { status: 500 });
  }
}
