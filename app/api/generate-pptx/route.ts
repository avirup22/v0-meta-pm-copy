import { NextRequest, NextResponse } from "next/server"
import JSZip from "jszip"

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

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export async function POST(req: NextRequest) {
  try {
    const data: KickoffData = await req.json()
    const zip = new JSZip()

    // [Content_Types].xml - MUST be at root
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
<Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
<Override PartName="/ppt/slides/slide3.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
<Override PartName="/ppt/slides/slide4.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
<Override PartName="/ppt/slides/slide5.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
<Override PartName="/ppt/slides/slide6.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
<Override PartName="/ppt/slides/slide7.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
<Override PartName="/ppt/slides/slide8.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
</Types>`
    )

    // _rels/.rels
    zip.file(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`
    )

    // ppt/_rels/presentation.xml.rels
    zip.file(
      "ppt/_rels/presentation.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide3.xml"/>
<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide4.xml"/>
<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide5.xml"/>
<Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide6.xml"/>
<Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide7.xml"/>
<Relationship Id="rId8" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide8.xml"/>
</Relationships>`
    )

    // ppt/presentation.xml
    zip.file(
      "ppt/presentation.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<p:sldIdLst>
<p:sldId id="256" r:id="rId1"/>
<p:sldId id="257" r:id="rId2"/>
<p:sldId id="258" r:id="rId3"/>
<p:sldId id="259" r:id="rId4"/>
<p:sldId id="260" r:id="rId5"/>
<p:sldId id="261" r:id="rId6"/>
<p:sldId id="262" r:id="rId7"/>
<p:sldId id="263" r:id="rId8"/>
</p:sldIdLst>
</p:presentation>`
    )

    // Slide 1: Title
    zip.file("ppt/slides/slide1.xml", createSlide("Title", data))

    // Slides 2-8
    zip.file("ppt/slides/slide2.xml", createContentSlide("Project Overview", [data.overview]))
    zip.file("ppt/slides/slide3.xml", createContentSlide("Objectives", data.objectives))
    zip.file("ppt/slides/slide4.xml", createContentSlide("Scope", data.scope))
    zip.file("ppt/slides/slide5.xml", createContentSlide("Team", data.team.map(m => `${m.name} (${m.role})`)))
    zip.file("ppt/slides/slide6.xml", createContentSlide("Timeline", data.milestones.map(m => `${m.name} – ${m.date}`)))
    zip.file("ppt/slides/slide7.xml", createContentSlide("Risks", data.risks.map(r => `${r.description}`)))
    zip.file("ppt/slides/slide8.xml", createContentSlide("Next Steps", data.nextSteps))

    // Minimal master/layout
    zip.file("ppt/slideMasters/slideMaster1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name="Master"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9144000" cy="6858000"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld></p:sldMaster>`)
    zip.file("ppt/slideLayouts/slideLayout1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name="Layout"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9144000" cy="6858000"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld></p:sldLayout>`)

    const buffer = await zip.generateAsync({ type: "arraybuffer" })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${data.projectName}-Kickoff.pptx"`,
      },
    })
  } catch (err) {
    console.error("[v0] PPTX error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

function createSlide(type: string, data: KickoffData): string {
  if (type === "Title") {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name="Title"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9144000" cy="6858000"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="1371600"/><a:ext cx="8229600" cy="1828800"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="5400" b="1"/><a:t>${escapeXml(data.projectName)}</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Subtitle"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="3657600"/><a:ext cx="8229600" cy="914400"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="2400"/><a:t>${escapeXml(data.client)} • ${escapeXml(data.projectManager)}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`
  }
  return ""
}

function createContentSlide(title: string, items: string[]): string {
  const bullets = items.map(item => `<a:p><a:r><a:rPr sz="2400"/><a:t>${escapeXml(item)}</a:t></a:r></a:p>`).join("")
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name="Slide"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9144000" cy="6858000"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="274638"/><a:ext cx="8229600" cy="914400"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="4400" b="1"/><a:t>${escapeXml(title)}</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="1371600"/><a:ext cx="8229600" cy="4914000"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/>${bullets}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`
}
