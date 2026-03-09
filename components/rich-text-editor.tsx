"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Table from "@tiptap/extension-table"
import TableRow from "@tiptap/extension-table-row"
import TableHeader from "@tiptap/extension-table-header"
import TableCell from "@tiptap/extension-table-cell"
import { Bold, Italic, List, ListOrdered, Table as TableIcon, Undo2, Redo2 } from "lucide-react"

interface RichTextEditorProps {
  content: string
  onChange: (content: string) => void
  disabled?: boolean
}

export function RichTextEditor({ content, onChange, disabled = false }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  if (!editor) {
    return null
  }

  return (
    <div className="flex flex-col gap-2 border border-border rounded-lg overflow-hidden">
      {!disabled && (
        <div className="flex flex-wrap gap-1 p-2 bg-secondary border-b border-border">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={!editor.can().chain().focus().toggleBold().run()}
            className={`p-2 rounded hover:bg-background transition-colors ${
              editor.isActive("bold") ? "bg-primary text-primary-foreground" : "text-foreground"
            }`}
            title="Bold"
          >
            <Bold size={16} strokeWidth={2} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={!editor.can().chain().focus().toggleItalic().run()}
            className={`p-2 rounded hover:bg-background transition-colors ${
              editor.isActive("italic") ? "bg-primary text-primary-foreground" : "text-foreground"
            }`}
            title="Italic"
          >
            <Italic size={16} strokeWidth={2} />
          </button>
          <div className="w-px bg-border" />
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-2 rounded hover:bg-background transition-colors ${
              editor.isActive("bulletList") ? "bg-primary text-primary-foreground" : "text-foreground"
            }`}
            title="Bullet List"
          >
            <List size={16} strokeWidth={2} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-2 rounded hover:bg-background transition-colors ${
              editor.isActive("orderedList") ? "bg-primary text-primary-foreground" : "text-foreground"
            }`}
            title="Ordered List"
          >
            <ListOrdered size={16} strokeWidth={2} />
          </button>
          <button
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
            className="p-2 rounded hover:bg-background transition-colors text-foreground"
            title="Insert Table"
          >
            <TableIcon size={16} strokeWidth={2} />
          </button>
          <div className="w-px bg-border" />
          <button
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().chain().focus().undo().run()}
            className="p-2 rounded hover:bg-background transition-colors text-foreground disabled:opacity-50"
            title="Undo"
          >
            <Undo2 size={16} strokeWidth={2} />
          </button>
          <button
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().chain().focus().redo().run()}
            className="p-2 rounded hover:bg-background transition-colors text-foreground disabled:opacity-50"
            title="Redo"
          >
            <Redo2 size={16} strokeWidth={2} />
          </button>
        </div>
      )}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none px-4 py-3 text-foreground bg-background min-h-[300px] focus-within:outline-none"
      />
    </div>
  )
}
