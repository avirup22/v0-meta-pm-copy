'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { updateExcelRow } from '@/lib/graph'
import type { ProjectRow } from '@/lib/graph'

interface EditProjectModalProps {
  project: ProjectRow
  folderId: string
  onClose: () => void
  onSave: () => Promise<void>
}

export function EditProjectModal({ project, folderId, onClose, onSave }: EditProjectModalProps) {
  const { token } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    Client_Name: project.Client_Name,
    Project_Name: project.Project_Name,
    Project_Manager: project.Project_Manager,
    Start_Date: project.Start_Date,
    End_date: project.End_date,
    Project_status: project.Project_status,
    Project_Type: project.Project_Type,
  })

  async function handleSave() {
    if (!token) {
      setError('Not authenticated')
      return
    }

    setLoading(true)
    setError(null)
    try {
      // Update Excel row (will implement updateExcelRow in graph.ts)
      await updateExcelRow(token, 'projects', folderId, formData)
      await onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-md max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground font-sans">Edit Project Details</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {/* Client Name */}
          <div>
            <label className="text-xs font-semibold text-foreground font-sans block mb-1.5">Client Name</label>
            <input
              type="text"
              value={formData.Client_Name}
              onChange={(e) => setFormData({ ...formData, Client_Name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs font-sans focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Project Name */}
          <div>
            <label className="text-xs font-semibold text-foreground font-sans block mb-1.5">Project Name</label>
            <input
              type="text"
              value={formData.Project_Name}
              onChange={(e) => setFormData({ ...formData, Project_Name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs font-sans focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Project Manager */}
          <div>
            <label className="text-xs font-semibold text-foreground font-sans block mb-1.5">Project Manager</label>
            <input
              type="text"
              value={formData.Project_Manager}
              onChange={(e) => setFormData({ ...formData, Project_Manager: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs font-sans focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Start Date */}
          <div>
            <label className="text-xs font-semibold text-foreground font-sans block mb-1.5">Start Date (dd-mm-yyyy)</label>
            <input
              type="text"
              placeholder="dd-mm-yyyy"
              value={formData.Start_Date}
              onChange={(e) => setFormData({ ...formData, Start_Date: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs font-sans focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="text-xs font-semibold text-foreground font-sans block mb-1.5">End Date (dd-mm-yyyy)</label>
            <input
              type="text"
              placeholder="dd-mm-yyyy"
              value={formData.End_date}
              onChange={(e) => setFormData({ ...formData, End_date: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs font-sans focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-semibold text-foreground font-sans block mb-1.5">Project Status</label>
            <select
              value={formData.Project_status}
              onChange={(e) => setFormData({ ...formData, Project_status: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs font-sans focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option>Planning</option>
              <option>Active</option>
              <option>On Hold</option>
              <option>Completed</option>
              <option>Closed</option>
            </select>
          </div>

          {/* Type */}
          <div>
            <label className="text-xs font-semibold text-foreground font-sans block mb-1.5">Project Type</label>
            <input
              type="text"
              value={formData.Project_Type}
              onChange={(e) => setFormData({ ...formData, Project_Type: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs font-sans focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {error && (
            <p className="text-xs text-orange-500 font-sans">{error}</p>
          )}
        </div>

        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 text-xs font-sans rounded-lg border border-border hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 px-3 py-2 text-xs font-sans rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {loading && <Loader2 size={12} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
