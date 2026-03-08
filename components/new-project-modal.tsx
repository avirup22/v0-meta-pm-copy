'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { createFolder, insertProjectRow, insertTeamRows, type TeamMemberRow } from '@/lib/graph'

interface NewProjectModalProps {
  open: boolean
  onClose: () => void
  customerFolderId: string
  customerName: string
  onProjectCreated?: () => void
}

type FormStep = 'name' | 'details' | 'teams'

interface TeamMember {
  id: string
  name: string
  email: string
  designation: string
}

export function NewProjectModal({ open, onClose, customerFolderId, customerName, onProjectCreated }: NewProjectModalProps) {
  const router = useRouter()
  const { token, displayName } = useAuth()
  const [step, setStep] = useState<FormStep>('name')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Project name
  const [projectName, setProjectName] = useState('')

  // Step 2: Project details
  const [projectFolderId, setProjectFolderId] = useState<string | null>(null)
  const [client, setClient] = useState(customerName)
  const [manager, setManager] = useState(displayName || '')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState('Planning')
  const [type, setType] = useState('General')

  // Step 3: Teams
  const [internalTeam, setInternalTeam] = useState<TeamMember[]>([])
  const [clientTeam, setClientTeam] = useState<TeamMember[]>([])
  const [nextMemberId, setNextMemberId] = useState(1)

  if (!open) return null

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
      setStep('details')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder')
    } finally {
      setLoading(false)
    }
  }

  async function handleDetailsSubmit() {
    if (!projectFolderId || !client.trim() || !manager.trim() || !startDate.trim() || !endDate.trim()) {
      setError('All fields are required')
      return
    }
    setError(null)
    setStep('teams')
  }

  async function handleTeamsSubmit() {
    if (!projectFolderId || !token) {
      setError('Missing project folder ID or token')
      return
    }

    setLoading(true)
    setError(null)
    try {
      // Insert project row
      const projectRow = {
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

      // Insert team rows
      const internalRows: TeamMemberRow[] = internalTeam.map((m) => ({
        Project_folder_ID: projectFolderId,
        Name: m.name,
        Email: m.email,
        Designation: m.designation,
      }))
      const clientRows: TeamMemberRow[] = clientTeam.map((m) => ({
        Project_folder_ID: projectFolderId,
        Name: m.name,
        Email: m.email,
        Designation: m.designation,
      }))

      if (internalRows.length > 0) await insertTeamRows(token, 'internal_team', internalRows)
      if (clientRows.length > 0) await insertTeamRows(token, 'client_team', clientRows)

      onProjectCreated?.()
      onClose()
      router.push(`/projects/${projectName.toLowerCase().replace(/\s+/g, '-')}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project')
    } finally {
      setLoading(false)
    }
  }

  function addTeamMember(team: 'internal' | 'client') {
    const newMember: TeamMember = {
      id: `team-${nextMemberId}`,
      name: '',
      email: '',
      designation: '',
    }
    if (team === 'internal') {
      setInternalTeam([...internalTeam, newMember])
    } else {
      setClientTeam([...clientTeam, newMember])
    }
    setNextMemberId(nextMemberId + 1)
  }

  function removeTeamMember(team: 'internal' | 'client', id: string) {
    if (team === 'internal') {
      setInternalTeam(internalTeam.filter((m) => m.id !== id))
    } else {
      setClientTeam(clientTeam.filter((m) => m.id !== id))
    }
  }

  function updateTeamMember(team: 'internal' | 'client', id: string, field: keyof TeamMember, value: string) {
    const setter = team === 'internal' ? setInternalTeam : setClientTeam
    const arr = team === 'internal' ? internalTeam : clientTeam
    setter(arr.map((m) => (m.id === id ? { ...m, [field]: value } : m)))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-xl border border-border shadow-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground font-sans">
            {step === 'name' && 'New Project'}
            {step === 'details' && 'Project Details'}
            {step === 'teams' && 'Add Team Members'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1" aria-label="Close">
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
              <button onClick={onClose} className="px-3 py-2 rounded-lg text-xs font-sans font-medium border border-border hover:bg-secondary transition-colors" disabled={loading}>
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={loading}
                className="px-3 py-2 rounded-lg text-xs font-sans font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? 'Creating...' : 'Next'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Project Details */}
        {step === 'details' && (
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1 font-sans">Client Name</label>
              <input
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm font-sans focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1 font-sans">Project Manager</label>
              <input
                type="text"
                value={manager}
                onChange={(e) => setManager(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm font-sans focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1 font-sans">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const d = new Date(e.target.value)
                    const dd = String(d.getDate()).padStart(2, '0')
                    const mm = String(d.getMonth() + 1).padStart(2, '0')
                    const yyyy = d.getFullYear()
                    setStartDate(`${dd}-${mm}-${yyyy}`)
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm font-sans focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1 font-sans">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    const d = new Date(e.target.value)
                    const dd = String(d.getDate()).padStart(2, '0')
                    const mm = String(d.getMonth() + 1).padStart(2, '0')
                    const yyyy = d.getFullYear()
                    setEndDate(`${dd}-${mm}-${yyyy}`)
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm font-sans focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1 font-sans">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm font-sans focus:outline-none focus:ring-2 focus:ring-primary" disabled={loading}>
                  <option>Planning</option>
                  <option>Active</option>
                  <option>On Hold</option>
                  <option>Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1 font-sans">Type</label>
                <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm font-sans focus:outline-none focus:ring-2 focus:ring-primary" disabled={loading}>
                  <option>General</option>
                  <option>Product Launch</option>
                  <option>Marketing Campaign</option>
                  <option>Research</option>
                </select>
              </div>
            </div>

            {error && <p className="text-xs text-red-500 font-sans">{error}</p>}
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setStep('name')} className="px-3 py-2 rounded-lg text-xs font-sans font-medium border border-border hover:bg-secondary transition-colors" disabled={loading}>
                Back
              </button>
              <button onClick={handleDetailsSubmit} disabled={loading} className="px-3 py-2 rounded-lg text-xs font-sans font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50">
                {loading ? 'Loading...' : 'Next'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Teams */}
        {step === 'teams' && (
          <div className="space-y-4 max-h-[calc(90vh-200px)] overflow-y-auto">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2 font-sans">Internal Team</h3>
              {internalTeam.length === 0 ? (
                <p className="text-xs text-muted-foreground mb-3 font-sans">No internal team members added</p>
              ) : (
                <div className="space-y-2 mb-3">
                  {internalTeam.map((member) => (
                    <div key={member.id} className="flex gap-2 items-end">
                      <input
                        type="text"
                        placeholder="Name"
                        value={member.name}
                        onChange={(e) => updateTeamMember('internal', member.id, 'name', e.target.value)}
                        className="flex-1 px-2 py-1.5 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={member.email}
                        onChange={(e) => updateTeamMember('internal', member.id, 'email', e.target.value)}
                        className="flex-1 px-2 py-1.5 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <input
                        type="text"
                        placeholder="Designation"
                        value={member.designation}
                        onChange={(e) => updateTeamMember('internal', member.id, 'designation', e.target.value)}
                        className="flex-1 px-2 py-1.5 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button onClick={() => removeTeamMember('internal', member.id)} className="p-1.5 hover:bg-destructive/20 rounded transition-colors">
                        <Trash2 size={14} className="text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => addTeamMember('internal')} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-sans font-medium transition-colors">
                <Plus size={12} />
                Add Internal Team Member
              </button>
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-foreground mb-2 font-sans">Client Team</h3>
              {clientTeam.length === 0 ? (
                <p className="text-xs text-muted-foreground mb-3 font-sans">No client team members added</p>
              ) : (
                <div className="space-y-2 mb-3">
                  {clientTeam.map((member) => (
                    <div key={member.id} className="flex gap-2 items-end">
                      <input
                        type="text"
                        placeholder="Name"
                        value={member.name}
                        onChange={(e) => updateTeamMember('client', member.id, 'name', e.target.value)}
                        className="flex-1 px-2 py-1.5 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={member.email}
                        onChange={(e) => updateTeamMember('client', member.id, 'email', e.target.value)}
                        className="flex-1 px-2 py-1.5 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <input
                        type="text"
                        placeholder="Designation"
                        value={member.designation}
                        onChange={(e) => updateTeamMember('client', member.id, 'designation', e.target.value)}
                        className="flex-1 px-2 py-1.5 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button onClick={() => removeTeamMember('client', member.id)} className="p-1.5 hover:bg-destructive/20 rounded transition-colors">
                        <Trash2 size={14} className="text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => addTeamMember('client')} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-sans font-medium transition-colors">
                <Plus size={12} />
                Add Client Team Member
              </button>
            </div>

            {error && <p className="text-xs text-red-500 font-sans">{error}</p>}
            <div className="flex gap-2 justify-end pt-4">
              <button onClick={() => setStep('details')} className="px-3 py-2 rounded-lg text-xs font-sans font-medium border border-border hover:bg-secondary transition-colors" disabled={loading}>
                Back
              </button>
              <button onClick={handleTeamsSubmit} disabled={loading} className="px-3 py-2 rounded-lg text-xs font-sans font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1">
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
