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

    // Generate as markdown text file instead - PowerPoint can't be reliably generated manually
    // User can copy-paste into PowerPoint or use a proper tool
    const markdown = `# ${data.projectName}

**Client:** ${data.client}  
**Project Manager:** ${data.projectManager}  
**Duration:** ${data.startDate} – ${data.endDate}

---

## Project Overview

${data.overview}

---

## Objectives

${data.objectives.map(obj => `- ${obj}`).join('\n')}

---

## Scope

### In Scope
${data.scope.map(item => `- ${item}`).join('\n')}

### Out of Scope
${data.outOfScope.map(item => `- ${item}`).join('\n')}

---

## Team

${data.team.map(m => `**${m.name}** (${m.role})  
${m.responsibilities}`).join('\n\n')}

---

## Timeline & Milestones

${data.milestones.map(m => `- ${m.name} — ${m.date}`).join('\n')}

---

## Key Risks

${data.risks.map(r => `**${r.description}** [${r.impact}]  
Mitigation: ${r.mitigation}`).join('\n\n')}

---

## Next Steps

${data.nextSteps.map(step => `- ${step}`).join('\n')}
`

    const buffer = Buffer.from(markdown, "utf-8")

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${data.projectName}-Kickoff.md"`,
      },
    })
  } catch (err) {
    console.error("[v0] Export error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
