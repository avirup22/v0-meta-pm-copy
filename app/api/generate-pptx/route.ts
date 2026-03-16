import { NextRequest, NextResponse } from "next/server"

interface KickoffData {
  projectName: string
  client: string
  startDate: string
  endDate: string
  projectManager: string
  overview: string
  objectives: string[]
  scope: string[]
  outOfScope: string[]
  team: Array<{ name: string; role: string; responsibilities: string }>
  milestones: Array<{ name: string; date: string }>
  risks: Array<{ description: string; impact: string; mitigation: string }>
  nextSteps: string[]
}

export async function POST(req: NextRequest) {
  try {
    const data: KickoffData = await req.json()

    // Dynamically import pptxgen-js server-side only
    const PptxGenJS = await import("pptxgen-js").then(m => m.default)
    const prs = new PptxGenJS()
    
    const KICKOFF_COLOR = "3D8F5C"
    prs.defineLayout({ name: "LAYOUT1", width: 10, height: 5.625 })

    // Slide 1: Title
    const slide1 = prs.addSlide("LAYOUT1")
    slide1.background = { fill: KICKOFF_COLOR }
    slide1.addText(data.projectName, {
      x: 0.5, y: 1.5, w: 9, h: 1.2,
      fontSize: 44, bold: true, color: "FFFFFF", align: "left", fontFace: "Arial"
    })
    slide1.addText(`${data.client} • ${data.projectManager}`, {
      x: 0.5, y: 2.8, w: 9, h: 0.4,
      fontSize: 14, color: "FFFFFFCC", align: "left", fontFace: "Arial"
    })
    slide1.addText(`${data.startDate} – ${data.endDate}`, {
      x: 0.5, y: 4.8, w: 9, h: 0.3,
      fontSize: 11, color: "FFFFFF99", align: "left", fontFace: "Arial"
    })

    // Slide 2: Overview
    const slide2 = prs.addSlide("LAYOUT1")
    slide2.background = { fill: "FFFFFF" }
    slide2.addText("Project Overview", {
      x: 0.5, y: 0.4, w: 9, h: 0.5,
      fontSize: 32, bold: true, color: "000000", fontFace: "Arial"
    })
    slide2.addText(data.overview, {
      x: 0.5, y: 1.1, w: 9, h: 2.5,
      fontSize: 12, color: "333333", align: "left", fontFace: "Arial"
    })

    // Slide 3: Objectives
    const slide3 = prs.addSlide("LAYOUT1")
    slide3.background = { fill: "FFFFFF" }
    slide3.addText("Objectives", {
      x: 0.5, y: 0.4, w: 9, h: 0.5,
      fontSize: 32, bold: true, color: "000000", fontFace: "Arial"
    })
    let objY = 1.1
    data.objectives.forEach(obj => {
      slide3.addText(`• ${obj}`, {
        x: 0.8, y: objY, w: 8.7, h: 0.5,
        fontSize: 11, color: "333333", align: "left", fontFace: "Arial"
      })
      objY += 0.55
    })

    // Slide 4: Scope
    const slide4 = prs.addSlide("LAYOUT1")
    slide4.background = { fill: "FFFFFF" }
    slide4.addText("Scope", {
      x: 0.5, y: 0.4, w: 9, h: 0.5,
      fontSize: 32, bold: true, color: "000000", fontFace: "Arial"
    })
    slide4.addText("In Scope", {
      x: 0.5, y: 1.1, w: 4.5, h: 0.35,
      fontSize: 13, bold: true, color: "2D7A4A", fontFace: "Arial"
    })
    let inScopeY = 1.5
    data.scope.forEach(item => {
      slide4.addText(`• ${item}`, {
        x: 0.7, y: inScopeY, w: 4, h: 0.4,
        fontSize: 10, color: "333333", fontFace: "Arial"
      })
      inScopeY += 0.45
    })
    slide4.addText("Out of Scope", {
      x: 5.2, y: 1.1, w: 4.5, h: 0.35,
      fontSize: 13, bold: true, color: "B84B4B", fontFace: "Arial"
    })
    let outScopeY = 1.5
    data.outOfScope.forEach(item => {
      slide4.addText(`• ${item}`, {
        x: 5.4, y: outScopeY, w: 4, h: 0.4,
        fontSize: 10, color: "333333", fontFace: "Arial"
      })
      outScopeY += 0.45
    })

    // Slide 5: Team
    const slide5 = prs.addSlide("LAYOUT1")
    slide5.background = { fill: "FFFFFF" }
    slide5.addText("Project Team", {
      x: 0.5, y: 0.4, w: 9, h: 0.5,
      fontSize: 32, bold: true, color: "000000", fontFace: "Arial"
    })
    let teamY = 1.1
    data.team.forEach(member => {
      slide5.addText(`${member.name} (${member.role})`, {
        x: 0.7, y: teamY, w: 8.6, h: 0.3,
        fontSize: 11, bold: true, color: "000000", fontFace: "Arial"
      })
      slide5.addText(member.responsibilities, {
        x: 0.9, y: teamY + 0.35, w: 8.4, h: 0.3,
        fontSize: 9, color: "666666", fontFace: "Arial"
      })
      teamY += 0.8
    })

    // Slide 6: Timeline
    const slide6 = prs.addSlide("LAYOUT1")
    slide6.background = { fill: "FFFFFF" }
    slide6.addText("Timeline & Milestones", {
      x: 0.5, y: 0.4, w: 9, h: 0.5,
      fontSize: 32, bold: true, color: "000000", fontFace: "Arial"
    })
    let milestoneY = 1.1
    data.milestones.forEach(m => {
      slide6.addText(`${m.name} — ${m.date}`, {
        x: 0.7, y: milestoneY, w: 8.6, h: 0.3,
        fontSize: 11, bold: true, color: "000000", fontFace: "Arial"
      })
      milestoneY += 0.55
    })

    // Slide 7: Risks
    const slide7 = prs.addSlide("LAYOUT1")
    slide7.background = { fill: "FFFFFF" }
    slide7.addText("Key Risks", {
      x: 0.5, y: 0.4, w: 9, h: 0.5,
      fontSize: 32, bold: true, color: "000000", fontFace: "Arial"
    })
    let riskY = 1.1
    data.risks.forEach(risk => {
      slide7.addText(`${risk.description} [${risk.impact}]`, {
        x: 0.7, y: riskY, w: 8.6, h: 0.3,
        fontSize: 10, bold: true, color: "000000", fontFace: "Arial"
      })
      slide7.addText(`Mitigation: ${risk.mitigation}`, {
        x: 0.9, y: riskY + 0.35, w: 8.4, h: 0.3,
        fontSize: 9, color: "666666", fontFace: "Arial", italic: true
      })
      riskY += 0.8
    })

    // Slide 8: Next Steps
    const slide8 = prs.addSlide("LAYOUT1")
    slide8.background = { fill: "FFFFFF" }
    slide8.addText("Next Steps", {
      x: 0.5, y: 0.4, w: 9, h: 0.5,
      fontSize: 32, bold: true, color: "000000", fontFace: "Arial"
    })
    let stepY = 1.1
    data.nextSteps.forEach(step => {
      slide8.addText(`• ${step}`, {
        x: 0.8, y: stepY, w: 8.7, h: 0.45,
        fontSize: 11, color: "333333", fontFace: "Arial"
      })
      stepY += 0.5
    })

    // Generate buffer
    const buf = await prs.write({ outputType: "arraybuffer" })
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${data.projectName}-Kickoff.pptx"`,
      },
    })
  } catch (err) {
    console.error("PPTX generation error:", err)
    return NextResponse.json({ error: "Failed to generate PPTX" }, { status: 500 })
  }
}
