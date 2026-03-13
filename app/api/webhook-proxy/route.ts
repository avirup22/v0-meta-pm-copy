import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()

    console.log("[v0] API: webhook-proxy received:", payload.title)

    // Call the n8n webhook from server-side (no CORS issues)
    const webhookUrl = "https://indegene-sbx.app.n8n.cloud/webhook-test/mom-generator"

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      console.error("[v0] Webhook returned status:", res.status)
      const text = await res.text()
      return NextResponse.json(
        { error: `Webhook returned ${res.status}: ${text}` },
        { status: res.status }
      )
    }

    const data = await res.json()
    console.log("[v0] API: webhook response received")
    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] API: webhook-proxy error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to call webhook" },
      { status: 500 }
    )
  }
}
