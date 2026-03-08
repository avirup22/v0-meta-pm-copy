'use client'

import { useState } from 'react'
import { X, Loader2, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { insertTeamRows } from '@/lib/graph'
import type { TeamMemberRow } from '@/lib/graph'

interface EditTeamModalProps {
  title: string
  folderId: string
  team: TeamMemberRow[]
  sheet: 'internal_team' | 'client_team'
  onClose: () => void
  onSave: () => Promise<void>
}

interface TeamMember {
  id: string
  name: string
  email: string
  designation: string
}

export function EditTeamModal({ title, folderId, team, sheet, onClose, onSave }: EditTeamModalProps) {
  const { token } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [members, setMembers] = useState<TeamMember[]>(
    team.map((m, i) => ({ id: String(i), name: m.Name, email: m.Email, designation: m.Designation }))
  )
  const [nextId, setNextId] = useState(team.length)

  function addMember() {
    setMembers([...members, { id: String(nextId), name: '', email: '', designation: '' }])
    setNextId(nextId + 1)
  }

  function removeMember(id: string) {
    setMembers(members.filter((m) => m.id !== id))
  }

  function updateMember(id: string, field: keyof TeamMember, value: string) {
    setMembers(members.map((m) => (m.id === id ? { ...m, [field]: value } : m)))
  }

  async function handleSave() {
    if (!token) {
      setError('Not authenticated')
      return
    }

    if (members.some((m) => !m.name.trim() || !m.email.trim() || !m.designation.trim())) {
      setError('All fields are required for each team member')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const newMembers = members.map((m) => ({
        Project_folder_ID: folderId,
        Name: m.name,
        Email: m.email,
        Designation: m.designation,
      }))
      await insertTeamRows(token, newMembers, sheet)
      await onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save team members')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-md max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground font-sans">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
          {members.map((member) => (
            <div key={member.id} className="flex flex-col gap-2 pb-3 border-b border-border last:border-b-0">
              {/* Name */}
              <input
                type="text"
                placeholder="Name"
                value={member.name}
                onChange={(e) => updateMember(member.id, 'name', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs font-sans focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {/* Email */}
              <input
                type="email"
                placeholder="Email"
                value={member.email}
                onChange={(e) => updateMember(member.id, 'email', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs font-sans focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {/* Designation */}
              <input
                type="text"
                placeholder="Designation"
                value={member.designation}
                onChange={(e) => updateMember(member.id, 'designation', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs font-sans focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {/* Remove button */}
              <button
                onClick={() => removeMember(member.id)}
                className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <Trash2 size={12} />
                Remove
              </button>
            </div>
          ))}

          {error && (
            <p className="text-xs text-orange-500 font-sans">{error}</p>
          )}
        </div>

        <button
          onClick={addMember}
          className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-sans text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors"
        >
          <Plus size={12} />
          Add Team Member
        </button>

        <div className="flex items-center gap-2">
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
