import { NextResponse } from "next/server";

// Fuerza render en cada request: refleja SIEMPRE el build desplegado en este
// momento (sin cache estático), para que las tablets detecten versiones nuevas.
export const dynamic = "force-dynamic";

export async function GET() {
  const sha = (
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF ||
    "dev"
  ).slice(0, 8);
  return NextResponse.json({ sha });
}
