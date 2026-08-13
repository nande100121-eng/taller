import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { image, apiKey, provider = "gemini", model } = body;

    if (!image) {
      return NextResponse.json({ success: false, error: "No se proporcionó imagen para procesar." }, { status: 400 });
    }

    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json({
        success: false,
        error: "No hay API Key de IA configurada. Por favor ingrese su API Key en la pestaña Configuración o digite la placa manualmente.",
      });
    }

    const cleanKey = apiKey.trim();

    // Extract base64 and mime type
    let mimeType = "image/jpeg";
    let base64Pure = image;
    if (image.startsWith("data:")) {
      const parts = image.split(";base64,");
      mimeType = parts[0].replace("data:", "") || "image/jpeg";
      base64Pure = parts[1] || "";
    }

    const systemPrompt = `Eres un asistente experto de OCR e inspección automotriz para talleres en Perú.
Analiza la imagen adjunta (que puede ser una fotografía de un vehículo, su placa de rodaje o una tarjeta de propiedad).
Extrae con la mayor precisión posible:
1. plate: Placa de rodaje del vehículo (ejemplo: ABC-123, B7V-456, F9K-112). Si no es legible o no aparece, devuelve "".
2. brand: Marca del vehículo (Toyota, Nissan, Hyundai, Kia, Chevrolet, etc.). Si no estás seguro, devuelve "".
3. model: Modelo del vehículo (Yaris, Corolla, Sentra, Rio, Elantra, etc.). Si no estás seguro, devuelve "".
4. color: Color predominante del vehículo (Blanco, Negro, Plata, Gris, Rojo, Azul, etc.). Si no estás seguro, devuelve "".
5. fuel_type: "GNV", "GLP", "Gasolina" o "Bifuel" (si observas calcomanía de gas en el parabrisas/maletera o emblemas). Si no estás seguro, devuelve "".

Responde EXCLUSIVAMENTE con un JSON con la siguiente estructura:
{
  "plate": string,
  "brand": string,
  "model": string,
  "color": string,
  "fuel_type": string
}`;

    // 1. Google Gemini Provider (starts with AIza or provider is gemini/google)
    const isGemini = cleanKey.startsWith("AIza") || provider === "gemini" || provider === "google";

    if (isGemini) {
      try {
        const geminiModel = model && model.includes("gemini") ? model : "gemini-1.5-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${cleanKey}`;

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: systemPrompt },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: base64Pure,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              response_mime_type: "application/json",
              temperature: 0.1,
            },
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const errMsg = errData?.error?.message || `Error en Google Gemini (${response.status})`;
          return NextResponse.json({
            success: false,
            error: `Error al consultar IA Gemini: ${errMsg}`,
          });
        }

        const resData = await response.json();
        const rawContent = resData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawContent) {
          return NextResponse.json({
            success: false,
            error: "La IA no devolvió respuesta para la imagen enviada.",
          });
        }

        const cleanedJson = rawContent.replace(/```json/gi, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanedJson);

        return NextResponse.json({
          success: true,
          data: {
            plate: typeof parsed.plate === "string" ? parsed.plate.trim().toUpperCase() : "",
            brand: typeof parsed.brand === "string" ? parsed.brand.trim() : "",
            model: typeof parsed.model === "string" ? parsed.model.trim() : "",
            color: typeof parsed.color === "string" ? parsed.color.trim() : "",
            fuel_type: typeof parsed.fuel_type === "string" ? parsed.fuel_type.trim() : "",
          },
          isRealAI: true,
        });
      } catch (geminiErr: any) {
        return NextResponse.json({
          success: false,
          error: `Fallo al procesar OCR con Gemini: ${geminiErr?.message || geminiErr}`,
        });
      }
    }

    // 2. OpenAI Provider (starts with sk- or provider is openai)
    if (cleanKey.startsWith("sk-") || provider === "openai") {
      try {
        const openaiModel = model && (model.includes("gpt") || model.includes("o1")) ? model : "gpt-4o-mini";
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cleanKey}`,
          },
          body: JSON.stringify({
            model: openaiModel,
            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Por favor lee la placa y los datos del vehículo presente en esta imagen:",
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: image.startsWith("data:") ? image : `data:${mimeType};base64,${base64Pure}`,
                    },
                  },
                ],
              },
            ],
            response_format: { type: "json_object" },
            max_tokens: 300,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const errMsg = errData?.error?.message || `Error en OpenAI (${response.status})`;
          return NextResponse.json({
            success: false,
            error: `Error al consultar OpenAI Vision: ${errMsg}`,
          });
        }

        const aiData = await response.json();
        const content = aiData.choices?.[0]?.message?.content;
        const parsed = JSON.parse(content || "{}");

        return NextResponse.json({
          success: true,
          data: {
            plate: typeof parsed.plate === "string" ? parsed.plate.trim().toUpperCase() : "",
            brand: typeof parsed.brand === "string" ? parsed.brand.trim() : "",
            model: typeof parsed.model === "string" ? parsed.model.trim() : "",
            color: typeof parsed.color === "string" ? parsed.color.trim() : "",
            fuel_type: typeof parsed.fuel_type === "string" ? parsed.fuel_type.trim() : "",
          },
          isRealAI: true,
        });
      } catch (openaiErr: any) {
        return NextResponse.json({
          success: false,
          error: `Fallo al procesar OCR con OpenAI: ${openaiErr?.message || openaiErr}`,
        });
      }
    }

    return NextResponse.json({
      success: false,
      error: "Proveedor de IA no reconocido. Configure Gemini u OpenAI en Configuración.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Error interno del servidor durante el OCR." },
      { status: 500 }
    );
  }
}
