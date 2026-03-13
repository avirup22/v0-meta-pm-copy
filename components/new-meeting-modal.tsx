"use client"

import { useState, useRef } from "react"
import { X, Loader2, Upload, FileText } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { 
  sendTranscriptToWebhook, 
  fetchProjectDatabase, 
  saveMeetingDataToExcel 
} from "@/lib/graph"

interface NewMeetingModalProps {
  projectSlug: string
  projectFolderId: string
  onClose: () => void
  onCreated: (meetingData: any) => void
}

export function NewMeetingModal({ 
  projectSlug, 
  projectFolderId, 
  onClose, 
  onCreated 
}: NewMeetingModalProps) {
  const { token } = useAuth()
  const [step, setStep] = useState<"upload" | "details" | "processing" | "response">("upload")
  const [transcript, setTranscript] = useState("")
  const [fileName, setFileName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [webhookResponse, setWebhookResponse] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Store meeting context for saving
  const [meetingContext, setMeetingContext] = useState<{
    meetingId: string
    code: string
    projectTeam: Array<{ name: string; email: string; designation: string }>
  } | null>(null)
  
  const [meetingDetails, setMeetingDetails] = useState({
    title: "",
    date: new Date().toISOString().split("T")[0],
    momStyle: "INTERNAL" as "INTERNAL" | "EXECUTIVE" | "CLIENT" | "VENDOR" | "DETAILED",
  })

  const MOM_STYLES = ["INTERNAL", "EXECUTIVE", "CLIENT", "VENDOR", "DETAILED"] as const

  function generateCode(): string {
    return Math.floor(10000000 + Math.random() * 90000000).toString()
  }

  function vttToPlainText(vttContent: string): string {
    // Remove VTT header
    let text = vttContent.replace(/^WEBVTT\n\n/, "")
    
    // Remove timestamps (hh:mm:ss.ms --> hh:mm:ss.ms)
    text = text.replace(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}\n/g, "")
    
    // Remove empty lines
    text = text.replace(/^\s*$/gm, "")
    
    // Clean up multiple spaces and line breaks
    text = text.replace(/\n\n+/g, "\n").trim()
    
    return text
  }

  async function handleFileSelect(file: File) {
    if (!file.name.endsWith(".vtt")) {
      setError("Please upload a .vtt file")
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const vttContent = await file.text()
      const plainText = vttToPlainText(vttContent)
      
      setTranscript(plainText)
      setFileName(file.name)
      setStep("details")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file")
    } finally {
      setLoading(false)
    }
  }

  async function handleDetailsSubmit() {
    if (!meetingDetails.title.trim() || !meetingDetails.date.trim()) {
      setError("Please fill in all meeting details")
      return
    }

    if (!token) {
      setError("Not authenticated")
      return
    }

    setStep("processing")
    setLoading(true)
    setError(null)

    try {
      // Generate a meeting ID and code
      const meetingId = `${Date.now()}`
      const code = generateCode()

      // Convert date from YYYY-MM-DD to dd-mm-yyyy for the webhook
      const [year, month, day] = meetingDetails.date.split("-")
      const formattedDate = `${day}-${month}-${year}`

      // Fetch project team data (both internal and client)
      const projectData = await fetchProjectDatabase(token, projectFolderId)
      const projectTeam = [
        ...projectData.internalTeam.map((member) => ({
          name: member.Name,
          email: member.Email,
          designation: member.Designation,
        })),
        ...projectData.clientTeam.map((member) => ({
          name: member.Name,
          email: member.Email,
          designation: member.Designation,
        })),
      ]

      // Store meeting context for later use
      setMeetingContext({ meetingId, code, projectTeam })

      // Send to webhook
      const response = await sendTranscriptToWebhook({
        title: meetingDetails.title,
        date: formattedDate,
        meeting_id: meetingId,
        code,
        project_id: projectFolderId,
        project_team: projectTeam,
        mom_style: meetingDetails.momStyle,
        transcript,
      })

      // Show the response in a popup
      setWebhookResponse(response)
      setStep("response")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process meeting")
      setStep("details")
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmResponse() {
    if (!meetingContext || !token) {
      setError("Missing meeting context")
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Save the meeting data to Excel
      const [year, month, day] = meetingDetails.date.split("-")
      const formattedDate = `${day}-${month}-${year}`

      await saveMeetingDataToExcel(
        token,
        projectFolderId,
        meetingContext.meetingId,
        meetingDetails.title,
        formattedDate,
        meetingContext.code,
        meetingContext.projectTeam,
        webhookResponse
      )

      console.log("[v0] Meeting data saved to Excel successfully")
      onCreated(webhookResponse)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save meeting data")
      console.error("[v0] Error saving meeting data:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground font-sans">
            {step === "upload" && "Upload Meeting Transcript"}
            {step === "details" && "Meeting Details"}
            {step === "processing" && "Processing Meeting"}
            {step === "response" && "Webhook Response"}
          </h2>
          {step !== "processing" && (
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X size={20} strokeWidth={2} />
            </button>
          )}
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-sm font-sans">
            {error}
          </div>
        )}

        {step === "upload" && (
          <div className="flex flex-col gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".vtt"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileSelect(file)
              }}
              className="hidden"
            />
            
            {fileName ? (
              <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-secondary">
                <FileText size={24} className="text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground font-sans truncate">{fileName}</p>
                  <p className="text-xs text-muted-foreground font-sans">VTT transcript loaded</p>
                </div>
                <button
                  onClick={() => {
                    setFileName(null)
                    setTranscript("")
                    if (fileInputRef.current) fileInputRef.current.value = ""
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="flex flex-col items-center justify-center gap-3 p-8 rounded-lg border-2 border-dashed border-border bg-secondary hover:border-primary transition-colors cursor-pointer disabled:opacity-50"
              >
                <Upload size={32} className="text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground font-sans">Click to upload VTT file</p>
                  <p className="text-xs text-muted-foreground font-sans mt-1">or drag and drop</p>
                </div>
              </button>
            )}
            
            <div className="flex gap-3 ml-auto">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-sans text-foreground border border-border rounded-lg hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep("details")}
                disabled={!fileName || loading}
                className="px-4 py-2 text-sm font-sans text-primary-foreground rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                style={{ background: "var(--primary)" }}
              >
                {loading ? (
                  <>
                    <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Next"
                )}
              </button>
            </div>
          </div>
        )}

        {step === "details" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-foreground font-sans">Meeting Title</label>
              <input
                type="text"
                placeholder="e.g., Q4 Planning Session"
                value={meetingDetails.title}
                onChange={(e) => setMeetingDetails({ ...meetingDetails, title: e.target.value })}
                className="px-4 py-2 rounded-lg border border-border bg-background text-foreground font-sans text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-foreground font-sans">Meeting Date</label>
              <input
                type="date"
                value={meetingDetails.date}
                onChange={(e) => setMeetingDetails({ ...meetingDetails, date: e.target.value })}
                className="px-4 py-2 rounded-lg border border-border bg-background text-foreground font-sans text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-foreground font-sans">MOM Style</label>
              <select
                value={meetingDetails.momStyle}
                onChange={(e) => setMeetingDetails({ ...meetingDetails, momStyle: e.target.value as typeof meetingDetails.momStyle })}
                className="px-4 py-2 rounded-lg border border-border bg-background text-foreground font-sans text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {MOM_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {style}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 ml-auto">
              <button
                onClick={() => setStep("upload")}
                className="px-4 py-2 text-sm font-sans text-foreground border border-border rounded-lg hover:bg-secondary transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleDetailsSubmit}
                disabled={loading}
                className="px-4 py-2 text-sm font-sans text-primary-foreground rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                style={{ background: "var(--primary)" }}
              >
                {loading ? (
                  <>
                    <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Submit"
                )}
              </button>
            </div>
          </div>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <Loader2 size={40} strokeWidth={1.5} className="text-primary animate-spin" />
            <p className="text-sm font-sans text-muted-foreground text-center">
              Processing your meeting transcript with AI...
            </p>
          </div>
        )}

        {step === "response" && webhookResponse && (
          <div className="flex flex-col gap-4">
            <div className="bg-secondary rounded-lg p-4 max-h-[400px] overflow-y-auto border border-border">
              <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-words">
                {JSON.stringify(webhookResponse, null, 2)}
              </pre>
            </div>
            <p className="text-xs text-muted-foreground font-sans">
              This is the webhook response from n8n. Please review and let us know where to save each field in your Excel database.
            </p>
            <div className="flex gap-3 ml-auto">
              <button
                onClick={() => setStep("details")}
                className="px-4 py-2 text-sm font-sans text-foreground border border-border rounded-lg hover:bg-secondary transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleConfirmResponse}
                disabled={loading}
                className="px-4 py-2 text-sm font-sans text-primary-foreground rounded-lg transition-colors disabled:opacity-50"
                style={{ background: "var(--primary)" }}
              >
                {loading ? (
                  <>
                    <Loader2 size={14} strokeWidth={2} className="animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  "Confirm & Save"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
