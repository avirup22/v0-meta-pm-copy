"use client"

import { useState } from "react"
import { X, Loader2, Upload } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { sendTranscriptToWebhook, fetchProjectDatabase } from "@/lib/graph"

interface NewMeetingModalProps {
  projectSlug: string
  onClose: () => void
  onCreated: (meetingData: any) => void
}

export function NewMeetingModal({ projectSlug, onClose, onCreated }: NewMeetingModalProps) {
  const { token } = useAuth()
  const [step, setStep] = useState<"upload" | "details" | "processing">("upload")
  const [transcript, setTranscript] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [meetingDetails, setMeetingDetails] = useState({
    title: "",
    date: "",
  })

  function generateCode(): string {
    return Math.floor(10000000 + Math.random() * 90000000).toString()
  }

  async function handleUploadSubmit() {
    if (!transcript.trim()) {
      setError("Please provide a transcript")
      return
    }
    setStep("details")
    setError(null)
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

      // Note: In a real implementation, you'd need to resolve the projectSlug to a projectFolderId
      // For now, we'll use a placeholder and fetch the project data
      // This is simplified - you should implement proper slug resolution
      const projectFolderId = projectSlug // This should be resolved from the database

      // Fetch project team data
      const projectData = await fetchProjectDatabase(token, projectFolderId)
      const projectTeam = projectData.internalTeam.map((member) => ({
        name: member.Name,
        email: member.Email,
        designation: member.Designation,
      }))

      // Send to webhook
      const webhookResponse = await sendTranscriptToWebhook({
        title: meetingDetails.title,
        date: meetingDetails.date,
        meeting_id: meetingId,
        code,
        project_id: projectFolderId,
        project_team: projectTeam,
        transcript,
      })

      console.log("[v0] Webhook response:", webhookResponse)

      // Call the onCreated callback with the response
      onCreated(webhookResponse)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process meeting")
      setStep("details")
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
            <textarea
              placeholder="Paste your meeting transcript here..."
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground font-sans text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[300px]"
            />
            <div className="flex gap-3 ml-auto">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-sans text-foreground border border-border rounded-lg hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadSubmit}
                className="px-4 py-2 text-sm font-sans text-primary-foreground rounded-lg transition-colors flex items-center gap-2"
                style={{ background: "var(--primary)" }}
              >
                <Upload size={14} strokeWidth={2} />
                Next
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
              <label className="text-sm font-semibold text-foreground font-sans">Meeting Date (dd-mm-yyyy)</label>
              <input
                type="text"
                placeholder="dd-mm-yyyy"
                value={meetingDetails.date}
                onChange={(e) => setMeetingDetails({ ...meetingDetails, date: e.target.value })}
                className="px-4 py-2 rounded-lg border border-border bg-background text-foreground font-sans text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
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
      </div>
    </div>
  )
}
