'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { createFolder, insertProjectRow, insertTeamRows, type ProjectRow, type TeamMemberRow } from '@/lib/graph'

interface NewProjectModalProps {
  open: boolean
  onClose: () => void
  customerFolderId: string
  customerName: string
  onProjectCreated?: () => void
}

type FormStep = 'name' | 'form'

export function NewProjectModal({ open, onClose, customerFolderId, customerName, onProjectCreated }: NewProjectModalProps) {
  const router = useRouter()
  const { token } = useAuth()
  const [step, setStep] = useState<FormStep>('name')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Project name
  const [projectName, setProjectName] = useState('')

  // Step 2: Project details form
  const [projectFolderId, setProjectFolderId] = useState<string | null>(null)
  const [client, setClient] = useState('')
  const [manager, setManager] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState('Planning')
  const [type, setType] = useState('General')

  if (!open) return null

  // Helper: convert dd-mm-yyyy string to 'yyyy-mm-dd' for ISO
  function ddmmyyyyToIso(ddmmyyyy: string): string {
    const [dd, mm, yyyy] = ddmmyyyy.split('-')
    return `${yyyy}-${mm}-${dd}`
  }

  async function handleCreateFolder() {
    if (!projectName.trim()) {
      setError('Project name is required')
      return
    }
    if (!token) {
      setError('Not authenticated')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const folderId = await createFolder(token, customerFolderId, projectName)
      setProjectFolderId(folderId)
      setStep('form')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmitForm() {
    if (!projectFolderId || !client.trim() || !manager.trim() || !startDate.trim() || !endDate.trim()) {
      setError('All fields are required')
      return
    }
    if (!token) {
      setError('Not authenticated')
      return
    }

    setLoading(true)
    setError(null)
    try {
      // Insert project row
      const projectRow: ProjectRow = {
        Client_Name: client,
        Project_Name: projectName,
        Project_folder_ID: projectFolderId,
        Project_Manager: manager,
        Start_Date: startDate,
        End_date: endDate,
        Project_status: status,
        Project_Type: type,
      }
      await insertProjectRow(token, projectRow)
      onProjectCreated?.()
      onClose()
      router.push(`/projects/${projectName.toLowerCase().replace(/\s+/g, '-')}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-xl border border-border shadow-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground font-sans">
            {step === 'name' ? 'New Project' : 'Project Details'}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step 1: Project Name */}
        {step === 'name' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5 font-sans">Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter project name"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm font-sans placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={loading}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              />
            </div>
            <p className="text-xs text-muted-foreground font-sans">
              A folder will be created in <strong>{customerName}</strong> with this name.
            </p>
            {error && <p className="text-xs text-red-500 font-sans">{error}</p>}
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={onClose}
                className="px-3 py-2 rounded-lg text-xs font-sans font-medium border border-border hover:bg-secondary transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={loading}
                className="px-3 py-2 rounded-lg text-xs font-sans font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? 'Creating...' : 'Create Folder'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Project Details Form */}
        {step === 'form' && (
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1 font-sans">Client Name</label>
              <input
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="e.g. Gilead Sciences"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm font-sans placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1 font-sans">Project Manager</label>
              <input
                type="text"
                value={manager}
                onChange={(e) => setManager(e.target.value)}
                placeholder="e.g. Sarvesh Koyande"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm font-sans placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1 font-sans">Start Date (dd-mm-yyyy)</label>
                <input
                  type="text"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="01-01-2026"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm font-sans placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1 font-sans">End Date (dd-mm-yyyy)</label>
                <input
                  type="text"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="31-12-2026"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm font-sans placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1 font-sans">Project Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm font-sans focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={loading}
                >
                  <option>Planning</option>
                  <option>Active</option>
                  <option>On Hold</option>
                  <option>Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1 font-sans">Project Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm font-sans focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={loading}
                >
                  <option>General</option>
                  <option>Product Launch</option>
                  <option>Marketing Campaign</option>
                  <option>Research</option>
                </select>
              </div>
            </div>

            {error && <p className="text-xs text-red-500 font-sans">{error}</p>}
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => {
                  setStep('name')
                  setError(null)
                }}
                className="px-3 py-2 rounded-lg text-xs font-sans font-medium border border-border hover:bg-secondary transition-colors"
                disabled={loading}
              >
                Back
              </button>
              <button
                onClick={handleSubmitForm}
                disabled={loading}
                className="px-3 py-2 rounded-lg text-xs font-sans font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? 'Saving...' : 'Create Project'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
