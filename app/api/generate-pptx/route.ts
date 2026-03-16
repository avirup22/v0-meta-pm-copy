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
  return str.replace(/[<>&'"]/g, c => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
  }[c] || c))
}

function createTextSlide(title: string, content: string[]): string {
  const textElements = content
    .map(
      (text, i) => `
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${10 + i}" name="Text ${i + 1}"/>
          <p:cNvSpPr/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="914400" y="${1371600 + i * 457200}"/>
            <a:ext cx="8229600" cy="400000"/>
          </a:xfrm>
          <a:prstGeom prst="rect">
            <a:avLst/>
          </a:prstGeom>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="1100"/>
              <a:t>${escapeXml(text)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    `
    )
    .join("")

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:bg>
      <p:bgPr>
        <a:solidFill>
          <a:srgbClr val="FFFFFF"/>
        </a:solidFill>
        <a:effectLst/>
      </p:bgPr>
    </p:bg>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="9144000" cy="6858000"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="9144000" cy="6858000"/>
        </a:xfrm>
        <a:prstGeom prst="rect">
          <a:avLst/>
        </a:prstGeom>
      </p:grpSpPr>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title"/>
          <p:cNvSpPr/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="0" y="0"/>
            <a:ext cx="9144000" cy="914400"/>
          </a:xfrm>
          <a:prstGeom prst="rect">
            <a:avLst/>
          </a:prstGeom>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="3200" bold="1"/>
              <a:t>${escapeXml(title)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      ${textElements}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr>
    <a:masterClrMapping/>
  </p:clrMapOvr>
</p:sld>`
}

export async function POST(req: NextRequest) {
  try {
    const data: KickoffData = await req.json()

    const zip = new JSZip()

    // Add minimum PPTX structure
    zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
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
  <Override PartName="/ppt/presentation.xml.rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
</Types>`)

    zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`)

    zip.file("ppt/_rels/presentation.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide3.xml"/>
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide4.xml"/>
  <Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide5.xml"/>
  <Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide6.xml"/>
  <Relationship Id="rId8" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide7.xml"/>
  <Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide8.xml"/>
</Relationships>`)

    zip.file("ppt/presentation.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
                 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldMasterIdLst>
    <p:sldMasterId id="256" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId2"/>
    <p:sldId id="257" r:id="rId3"/>
    <p:sldId id="258" r:id="rId4"/>
    <p:sldId id="259" r:id="rId5"/>
    <p:sldId id="260" r:id="rId6"/>
    <p:sldId id="261" r:id="rId7"/>
    <p:sldId id="262" r:id="rId8"/>
    <p:sldId id="263" r:id="rId9"/>
  </p:sldIdLst>
  <p:notesMasterIdLst/>
  <p:handoutMasterIdLst/>
  <p:clrMapOvr><a:masterClrMapping xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/></p:clrMapOvr>
  <p:photoAlbum/>
</p:presentation>`)

    // Create slides
    zip.file(
      "ppt/slides/slide1.xml",
      createTextSlide(data.projectName, [
        `${data.client} • ${data.projectManager}`,
        `${data.startDate} – ${data.endDate}`,
      ])
    )
    zip.file("ppt/slides/slide2.xml", createTextSlide("Project Overview", [data.overview]))
    zip.file("ppt/slides/slide3.xml", createTextSlide("Objectives", data.objectives))
    zip.file(
      "ppt/slides/slide4.xml",
      createTextSlide("Scope", [
        "IN SCOPE:",
        ...data.scope,
        "",
        "OUT OF SCOPE:",
        ...data.outOfScope,
      ])
    )
    zip.file(
      "ppt/slides/slide5.xml",
      createTextSlide(
        "Project Team",
        data.team.flatMap(m => [`${m.name} (${m.role})`, m.responsibilities])
      )
    )
    zip.file(
      "ppt/slides/slide6.xml",
      createTextSlide(
        "Timeline & Milestones",
        data.milestones.map(m => `${m.name} — ${m.date}`)
      )
    )
    zip.file(
      "ppt/slides/slide7.xml",
      createTextSlide(
        "Key Risks",
        data.risks.flatMap(r => [
          `${r.description} [${r.impact}]`,
          `Mitigation: ${r.mitigation}`,
        ])
      )
    )
    zip.file("ppt/slides/slide8.xml", createTextSlide("Next Steps", data.nextSteps))

    // Minimal slideMaster & slideLayout
    zip.file(
      "ppt/slideMasters/slideMaster1.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></p:bgPr></p:bg></p:cSld>
</p:sldMaster>`
    )
    zip.file(
      "ppt/slideLayouts/slideLayout1.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr></p:spTree></p:cSld>
</p:sldLayout>`
    )

    const blob = await zip.generateAsync({ type: "arraybuffer" })

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${data.projectName}-Kickoff.pptx"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    })
  } catch (err) {
    console.error("PPTX generation error:", err)
    return NextResponse.json(
      { error: "Failed to generate PPTX", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
