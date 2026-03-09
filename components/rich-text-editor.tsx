"use client"

import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Bold, Italic, List, ListOrdered, Table as TableIcon, Eye, EyeOff } from "lucide-react"

interface RichTextEditorProps {
  content: string
  onChange: (content: string) => void
  disabled?: boolean
}

export function RichTextEditor({ content, onChange, disabled = false }: RichTextEditorProps) {
  const [showPreview, setShowPreview] = useState(false)

  const insertMarkdown = (before: string, after: string = "") => {
    const textarea = document.getElementById("markdown-editor") as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end) || "text"
    const newContent = content.substring(0, start) + before + selectedText + after + content.substring(end)

    onChange(newContent)
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length)
    }, 0)
  }

  const insertTable = () => {
    const table = "\n\n| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Data 1   | Data 2   | Data 3   |\n| Data 4   | Data 5   | Data 6   |\n\n"
    onChange(content + table)
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Toolbar */}
      <div className="flex gap-2 flex-wrap items-center p-3 border border-border rounded-lg bg-secondary">
        <button
          onClick={() => insertMarkdown("**", "**")}
          title="Bold (Ctrl+B)"
          className="p-2 hover:bg-background rounded transition-colors"
          disabled={disabled}
        >
          <Bold size={16} strokeWidth={2} />
        </button>
        <button
          onClick={() => insertMarkdown("*", "*")}
          title="Italic"
          className="p-2 hover:bg-background rounded transition-colors"
          disabled={disabled}
        >
          <Italic size={16} strokeWidth={2} />
        </button>
        <div className="w-px h-6 bg-border" />
        <button
          onClick={() => insertMarkdown("\n- ")}
          title="Bullet List"
          className="p-2 hover:bg-background rounded transition-colors"
          disabled={disabled}
        >
          <List size={16} strokeWidth={2} />
        </button>
        <button
          onClick={() => insertMarkdown("\n1. ")}
          title="Numbered List"
          className="p-2 hover:bg-background rounded transition-colors"
          disabled={disabled}
        >
          <ListOrdered size={16} strokeWidth={2} />
        </button>
        <div className="w-px h-6 bg-border" />
        <button
          onClick={insertTable}
          title="Insert Table"
          className="p-2 hover:bg-background rounded transition-colors"
          disabled={disabled}
        >
          <TableIcon size={16} strokeWidth={2} />
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="p-2 hover:bg-background rounded transition-colors flex items-center gap-2 text-sm"
          title={showPreview ? "Hide preview" : "Show preview"}
        >
          {showPreview ? (
            <>
              <EyeOff size={16} strokeWidth={2} />
              Edit
            </>
          ) : (
            <>
              <Eye size={16} strokeWidth={2} />
              Preview
            </>
          )}
        </button>
      </div>

      {/* Editor and Preview */}
      {showPreview ? (
        <div className="w-full min-h-[400px] p-4 border border-border rounded-lg bg-background prose prose-sm dark:prose-invert max-w-none prose-table:border prose-table:border-border prose-td:border prose-td:border-border prose-th:border prose-th:border-border">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content || "No content yet. Start typing to see preview..."}
          </ReactMarkdown>
        </div>
      ) : (
        <textarea
          id="markdown-editor"
          value={content}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Enter your meeting minutes using Markdown syntax. Use **bold**, *italic*, - for lists, and | for tables."
          className="w-full min-h-[400px] p-4 border border-border rounded-lg bg-background text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      )}

      {/* Markdown Help */}
      <div className="text-xs text-muted-foreground space-y-1 p-3 bg-secondary rounded-lg">
        <p className="font-semibold">Markdown formatting guide:</p>
        <ul className="space-y-1 ml-4 list-disc">
          <li><span className="font-mono">**bold text**</span> - Bold</li>
          <li><span className="font-mono">*italic text*</span> - Italic</li>
          <li><span className="font-mono">- item</span> - Bullet list</li>
          <li><span className="font-mono">1. item</span> - Numbered list</li>
          <li><span className="font-mono"># Heading</span> - Heading</li>
          <li>Tables: Use the table button or create with <span className="font-mono">| Column | Column |</span></li>
        </ul>
      </div>
    </div>
  )
}
