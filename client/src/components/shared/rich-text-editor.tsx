import ReactQuill from "react-quill";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const toolbar = [
  [{ header: [2, 3, false] }],
  ["bold", "italic", "underline", "strike"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["blockquote", "link"],
  ["clean"],
];

export function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  return (
    <ReactQuill
      theme="snow"
      value={value}
      onChange={onChange}
      modules={{ toolbar }}
      className="[&_.ql-container]:min-h-[140px] [&_.ql-editor]:min-h-[120px] [&_.ql-editor]:text-sm"
    />
  );
}
