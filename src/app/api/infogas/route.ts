// Proxy del consultor de placa de INFOGAS (https://apivh.infogas.com.pe/api/search).
// El navegador no puede llamar directamente al API externo por CORS, así que la
// consulta se hace desde el servidor Next.js. Devuelve ProximaRevAnual (Chip) y
// ProximoVencCilindro (Quinquenal). Se envía la placa SIN guion (el API rechaza
// "AUH-440" y responde solo con "AUH440").
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Región cercana a Perú (Sudamérica): Infogas puede bloquear IPs de centros de
// datos de EE.UU., por eso se fija São Paulo (gru1).
export const preferredRegion = ["gru1"];

const INFOGAS_URL = "https://apivh.infogas.com.pe/api/search";

async function consultInfogas(plateRaw: string) {
  const plate = String(plateRaw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!plate) {
    return NextResponse.json({ status: "Error", message: "Placa requerida" }, { status: 400 });
  }
  const form = new URLSearchParams();
  form.append("plate", plate);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(INFOGAS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json",
      },
      body: form.toString(),
      signal: controller.signal,
    });
    const data = await res.json();
    return NextResponse.json(data);
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    return consultInfogas(body?.plate || "");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: "Error", message: "Proxy Infogas: " + msg }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  try {
    return consultInfogas(req.nextUrl.searchParams.get("plate") || "");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: "Error", message: "Proxy Infogas: " + msg }, { status: 502 });
  }
}
