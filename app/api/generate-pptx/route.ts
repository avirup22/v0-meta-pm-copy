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
    
    // Dynamically import pptxgen-js at runtime
    const PptxGenJS = (await import("pptxgen-js")).default
    const prs = new PptxGenJS()

    prs.defineLayout({ name: "MASTER", width: 10, height: 5.625 })
    prs.defineLayout({ name: "BLANK", width: 10, height: 5.625 })

    const THEME_COLOR = "003366"
    const TEXT_COLOR = "333333"
    const ACCENT_COLOR = "0099CC"

    // Slide 1: Title Slide
    const slide1 = prs.addSlide("MASTER")
    slide1.background = { fill: THEME_COLOR }
    slide1.addText(data.projectName, {
      x: 0.5,
      y: 1.8,
      w: 9,
      h: 1.2,
      fontSize: 44,
      bold: true,
      color: "FFFFFF",
      align: "left",
      fontFace: "Arial",
    })
    slide1.addText(`${data.client} • ${data.projectManager}`, {
      x: 0.5,
      y: 3.1,
      w: 9,
      h: 0.5,
      fontSize: 16,
      color: "E6F2FF",
      align: "left",
      fontFace: "Arial",
    })
    slide1.addText(`${data.startDate} – ${data.endDate}`, {
      x: 0.5,
      y: 5,
      w: 9,
      h: 0.4,
      fontSize: 12,
      color: "99CCFF",
      align: "left",
      fontFace: "Arial",
    })

    // Slide 2: Overview
    const slide2 = prs.addSlide("BLANK")
    slide2.background = { fill: "FFFFFF" }
    slide2.addText("Project Overview", {
      x: 0.5,
      y: 0.4,
      w: 9,
      h: 0.6,
      fontSize: 32,
      bold: true,
      color: THEME_COLOR,
      fontFace: "Arial",
    })
    slide2.addText(data.overview, {
      x: 0.5,
      y: 1.2,
      w: 9,
      h: 3.8,
      fontSize: 14,
      color: TEXT_COLOR,
      align: "left",
      fontFace: "Arial",
    })

    // Slide 3: Objectives
    const slide3 = prs.addSlide("BLANK")
    slide3.background = { fill: "FFFFFF" }
    slide3.addText("Objectives", {
      x: 0.5,
      y: 0.4,
      w: 9,
      h: 0.6,
      fontSize: 32,
      bold: true,
      color: THEME_COLOR,
      fontFace: "Arial",
    })
    let objY = 1.2
    data.objectives.forEach(obj => {
      slide3.addText(`• ${obj}`, {
        x: 0.7,
        y: objY,
        w: 8.8,
        h: 0.5,
        fontSize: 13,
        color: TEXT_COLOR,
        fontFace: "Arial",
      })
      objY += 0.55
    })

    // Slide 4: Scope
    const slide4 = prs.addSlide("BLANK")
    slide4.background = { fill: "FFFFFF" }
    slide4.addText("Scope", {
      x: 0.5,
      y: 0.4,
      w: 9,
      h: 0.6,
      fontSize: 32,
      bold: true,
      color: THEME_COLOR,
      fontFace: "Arial",
    })
    slide4.addText("In Scope", {
      x: 0.5,
      y: 1.2,
      w: 4.5,
      h: 0.4,
      fontSize: 14,
      bold: true,
      color: "2D7A4A",
      fontFace: "Arial",
    })
    let inScopeY = 1.7
    data.scope.forEach(item => {
      slide4.addText(`• ${item}`, {
        x: 0.7,
        y: inScopeY,
        w: 4,
        h: 0.4,
        fontSize: 11,
        color: TEXT_COLOR,
        fontFace: "Arial",
      })
      inScopeY += 0.5
    })
    slide4.addText("Out of Scope", {
      x: 5.2,
      y: 1.2,
      w: 4.5,
      h: 0.4,
      fontSize: 14,
      bold: true,
      color: "C1440E",
      fontFace: "Arial",
    })
    let outScopeY = 1.7
    data.outOfScope.forEach(item => {
      slide4.addText(`• ${item}`, {
        x: 5.4,
        y: outScopeY,
        w: 4,
        h: 0.4,
        fontSize: 11,
        color: TEXT_COLOR,
        fontFace: "Arial",
      })
      outScopeY += 0.5
    })

    // Slide 5: Team
    const slide5 = prs.addSlide("BLANK")
    slide5.background = { fill: "FFFFFF" }
    slide5.addText("Project Team", {
      x: 0.5,
      y: 0.4,
      w: 9,
      h: 0.6,
      fontSize: 32,
      bold: true,
      color: THEME_COLOR,
      fontFace: "Arial",
    })
    let teamY = 1.2
    data.team.forEach(member => {
      slide5.addText(`${member.name} (${member.role})`, {
        x: 0.7,
        y: teamY,
        w: 8.8,
        h: 0.35,
        fontSize: 12,
        bold: true,
        color: TEXT_COLOR,
        fontFace: "Arial",
      })
      slide5.addText(member.responsibilities, {
        x: 0.9,
        y: teamY + 0.4,
        w: 8.6,
        h: 0.4,
        fontSize: 10,
        color: "666666",
        fontFace: "Arial",
      })
      teamY += 0.95
    })

    // Slide 6: Timeline
    const slide6 = prs.addSlide("BLANK")
    slide6.background = { fill: "FFFFFF" }
    slide6.addText("Timeline & Milestones", {
      x: 0.5,
      y: 0.4,
      w: 9,
      h: 0.6,
      fontSize: 32,
      bold: true,
      color: THEME_COLOR,
      fontFace: "Arial",
    })
    let milestoneY = 1.2
    data.milestones.forEach(m => {
      slide6.addText(`${m.name}`, {
        x: 0.7,
        y: milestoneY,
        w: 6,
        h: 0.35,
        fontSize: 12,
        bold: true,
        color: TEXT_COLOR,
        fontFace: "Arial",
      })
      slide6.addText(m.date, {
        x: 7,
        y: milestoneY,
        w: 2.5,
        h: 0.35,
        fontSize: 11,
        color: ACCENT_COLOR,
        bold: true,
        fontFace: "Arial",
      })
      milestoneY += 0.55
    })

    // Slide 7: Risks
    const slide7 = prs.addSlide("BLANK")
    slide7.background = { fill: "FFFFFF" }
    slide7.addText("Key Risks", {
      x: 0.5,
      y: 0.4,
      w: 9,
      h: 0.6,
      fontSize: 32,
      bold: true,
      color: THEME_COLOR,
      fontFace: "Arial",
    })
    let riskY = 1.2
    data.risks.forEach(risk => {
      slide7.addText(`${risk.description} [${risk.impact}]`, {
        x: 0.7,
        y: riskY,
        w: 8.8,
        h: 0.35,
        fontSize: 11,
        bold: true,
        color: "C1440E",
        fontFace: "Arial",
      })
      slide7.addText(`Mitigation: ${risk.mitigation}`, {
        x: 0.9,
        y: riskY + 0.4,
        w: 8.6,
        h: 0.35,
        fontSize: 10,
        color: "666666",
        fontFace: "Arial",
        italic: true,
      })
      riskY += 0.95
    })

    // Slide 8: Next Steps
    const slide8 = prs.addSlide("BLANK")
    slide8.background = { fill: "FFFFFF" }
    slide8.addText("Next Steps", {
      x: 0.5,
      y: 0.4,
      w: 9,
      h: 0.6,
      fontSize: 32,
      bold: true,
      color: THEME_COLOR,
      fontFace: "Arial",
    })
    let stepY = 1.2
    data.nextSteps.forEach(step => {
      slide8.addText(`• ${step}`, {
        x: 0.7,
        y: stepY,
        w: 8.8,
        h: 0.45,
        fontSize: 12,
        color: TEXT_COLOR,
        fontFace: "Arial",
      })
      stepY += 0.55
    })

    // Generate PPTX buffer
    const buffer = await prs.writeFile({ outputType: "arraybuffer" })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${data.projectName}-Kickoff.pptx"`,
      },
    })
  } catch (err) {
    console.error("[v0] PPTX generation error:", err)
    return NextResponse.json(
      { error: "Failed to generate PPTX", details: String(err) },
      { status: 500 }
    )
  }
}
