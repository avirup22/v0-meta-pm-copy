"use client"

import { useRef, useEffect } from "react"
import Konva from "konva"

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

interface KonvaSlideRendererProps {
  data: KickoffData
  currentSlide: number
}

const THEME_COLOR = "#003366"
const ACCENT_COLOR = "#0099CC"
const TEXT_COLOR = "#333333"
const LIGHT_TEXT = "#E6F2FF"

const SLIDE_WIDTH = 960
const SLIDE_HEIGHT = 540

export function KonvaSlideRenderer({ data, currentSlide }: KonvaSlideRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Create stage
    const stage = new Konva.Stage({
      container: containerRef.current,
      width: SLIDE_WIDTH,
      height: SLIDE_HEIGHT,
      scaleX: 1,
      scaleY: 1,
    })
    stageRef.current = stage

    // Create main layer
    const layer = new Konva.Layer()
    stage.add(layer)

    // Clear layer
    layer.destroyChildren()

    // Render slide based on currentSlide
    switch (currentSlide) {
      case 0:
        renderTitleSlide(layer, data)
        break
      case 1:
        renderOverviewSlide(layer, data)
        break
      case 2:
        renderObjectivesSlide(layer, data)
        break
      case 3:
        renderScopeSlide(layer, data)
        break
      case 4:
        renderTeamSlide(layer, data)
        break
      case 5:
        renderTimelineSlide(layer, data)
        break
      case 6:
        renderRisksSlide(layer, data)
        break
      case 7:
        renderNextStepsSlide(layer, data)
        break
    }

    layer.draw()

    return () => {
      stage.destroy()
    }
  }, [currentSlide, data])

  return <div ref={containerRef} className="w-full h-full" />
}

// ─── Slide Renderers ────────────────────────────────────────────────────────

function renderTitleSlide(layer: Konva.Layer, data: KickoffData) {
  // Background
  const bg = new Konva.Rect({
    x: 0,
    y: 0,
    width: SLIDE_WIDTH,
    height: SLIDE_HEIGHT,
    fill: THEME_COLOR,
  })
  layer.add(bg)

  // Project name
  const title = new Konva.Text({
    x: 30,
    y: 100,
    width: 900,
    text: data.projectName,
    fontSize: 48,
    fontFamily: "Arial, sans-serif",
    fontStyle: "bold",
    fill: "white",
    align: "left",
  })
  layer.add(title)

  // Client & PM
  const subtitle = new Konva.Text({
    x: 30,
    y: 180,
    width: 900,
    text: `${data.client} • ${data.projectManager}`,
    fontSize: 16,
    fontFamily: "Arial, sans-serif",
    fill: LIGHT_TEXT,
    align: "left",
  })
  layer.add(subtitle)

  // Dates
  const dates = new Konva.Text({
    x: 30,
    y: 480,
    width: 900,
    text: `${data.startDate} – ${data.endDate}`,
    fontSize: 12,
    fontFamily: "Arial, sans-serif",
    fill: "#99CCFF",
    align: "left",
  })
  layer.add(dates)
}

function renderOverviewSlide(layer: Konva.Layer, data: KickoffData) {
  renderContentSlideBase(layer, "Project Overview")

  const text = new Konva.Text({
    x: 30,
    y: 80,
    width: 900,
    text: data.overview,
    fontSize: 14,
    fontFamily: "Arial, sans-serif",
    fill: TEXT_COLOR,
    align: "left",
    lineHeight: 1.5,
  })
  layer.add(text)
}

function renderObjectivesSlide(layer: Konva.Layer, data: KickoffData) {
  renderContentSlideBase(layer, "Objectives")

  let y = 80
  data.objectives.forEach(obj => {
    const bullet = new Konva.Text({
      x: 30,
      y,
      width: 900,
      text: `• ${obj}`,
      fontSize: 13,
      fontFamily: "Arial, sans-serif",
      fill: TEXT_COLOR,
      align: "left",
    })
    layer.add(bullet)
    y += 40
  })
}

function renderScopeSlide(layer: Konva.Layer, data: KickoffData) {
  renderContentSlideBase(layer, "Scope")

  // In Scope title
  const inScopeTitle = new Konva.Text({
    x: 30,
    y: 80,
    text: "In Scope",
    fontSize: 14,
    fontFamily: "Arial, sans-serif",
    fontStyle: "bold",
    fill: "#2D7A4A",
  })
  layer.add(inScopeTitle)

  // In Scope items
  let y = 110
  data.scope.forEach(item => {
    const bullet = new Konva.Text({
      x: 40,
      y,
      width: 420,
      text: `• ${item}`,
      fontSize: 11,
      fontFamily: "Arial, sans-serif",
      fill: TEXT_COLOR,
    })
    layer.add(bullet)
    y += 35
  })

  // Out of Scope title
  const outScopeTitle = new Konva.Text({
    x: 510,
    y: 80,
    text: "Out of Scope",
    fontSize: 14,
    fontFamily: "Arial, sans-serif",
    fontStyle: "bold",
    fill: "#C1440E",
  })
  layer.add(outScopeTitle)

  // Out of Scope items
  y = 110
  data.outOfScope.forEach(item => {
    const bullet = new Konva.Text({
      x: 520,
      y,
      width: 420,
      text: `• ${item}`,
      fontSize: 11,
      fontFamily: "Arial, sans-serif",
      fill: TEXT_COLOR,
    })
    layer.add(bullet)
    y += 35
  })
}

function renderTeamSlide(layer: Konva.Layer, data: KickoffData) {
  renderContentSlideBase(layer, "Project Team")

  let y = 80
  data.team.forEach(member => {
    const name = new Konva.Text({
      x: 30,
      y,
      text: `${member.name} (${member.role})`,
      fontSize: 12,
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
      fill: TEXT_COLOR,
    })
    layer.add(name)

    const resp = new Konva.Text({
      x: 45,
      y: y + 20,
      width: 885,
      text: member.responsibilities,
      fontSize: 10,
      fontFamily: "Arial, sans-serif",
      fill: "#666666",
    })
    layer.add(resp)

    y += 70
  })
}

function renderTimelineSlide(layer: Konva.Layer, data: KickoffData) {
  renderContentSlideBase(layer, "Timeline & Milestones")

  let y = 80
  data.milestones.forEach(m => {
    const name = new Konva.Text({
      x: 30,
      y,
      width: 600,
      text: m.name,
      fontSize: 12,
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
      fill: TEXT_COLOR,
    })
    layer.add(name)

    const date = new Konva.Text({
      x: 650,
      y,
      text: m.date,
      fontSize: 11,
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
      fill: ACCENT_COLOR,
    })
    layer.add(date)

    y += 45
  })
}

function renderRisksSlide(layer: Konva.Layer, data: KickoffData) {
  renderContentSlideBase(layer, "Key Risks")

  let y = 80
  data.risks.forEach(risk => {
    const desc = new Konva.Text({
      x: 30,
      y,
      width: 900,
      text: `${risk.description} [${risk.impact}]`,
      fontSize: 11,
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
      fill: "#C1440E",
    })
    layer.add(desc)

    const mitigation = new Konva.Text({
      x: 45,
      y: y + 20,
      width: 885,
      text: `Mitigation: ${risk.mitigation}`,
      fontSize: 10,
      fontFamily: "Arial, sans-serif",
      fill: "#666666",
    })
    layer.add(mitigation)

    y += 65
  })
}

function renderNextStepsSlide(layer: Konva.Layer, data: KickoffData) {
  renderContentSlideBase(layer, "Next Steps")

  let y = 80
  data.nextSteps.forEach(step => {
    const bullet = new Konva.Text({
      x: 30,
      y,
      width: 900,
      text: `• ${step}`,
      fontSize: 12,
      fontFamily: "Arial, sans-serif",
      fill: TEXT_COLOR,
      align: "left",
    })
    layer.add(bullet)
    y += 45
  })
}

function renderContentSlideBase(layer: Konva.Layer, title: string) {
  // Background
  const bg = new Konva.Rect({
    x: 0,
    y: 0,
    width: SLIDE_WIDTH,
    height: SLIDE_HEIGHT,
    fill: "white",
  })
  layer.add(bg)

  // Title bar
  const titleBar = new Konva.Rect({
    x: 0,
    y: 0,
    width: SLIDE_WIDTH,
    height: 60,
    fill: "#F5F5F5",
    stroke: "#EEEEEE",
    strokeWidth: 1,
  })
  layer.add(titleBar)

  // Title text
  const titleText = new Konva.Text({
    x: 30,
    y: 15,
    text: title,
    fontSize: 32,
    fontFamily: "Arial, sans-serif",
    fontStyle: "bold",
    fill: THEME_COLOR,
  })
  layer.add(titleText)
}
