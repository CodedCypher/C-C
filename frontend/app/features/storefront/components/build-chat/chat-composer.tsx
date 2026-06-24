/**
 * The chat composer: a text box plus the photo and link doors carried over from
 * the old intake page. Send priority mirrors the backend: image > link > text.
 */

import { useRef, useState } from "react";
import { ImageUp, Link2, Send, X } from "lucide-react";

import { Button } from "~/components/ui/button";

export interface ComposerInput {
  text?: string;
  url?: string;
  image?: File;
}

export function ChatComposer({
  onSend,
  pending,
}: {
  onSend: (input: ComposerInput) => void;
  pending: boolean;
}) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [showUrl, setShowUrl] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function submit() {
    if (pending) return;
    if (file) {
      onSend({ image: file });
      setFile(null);
      return;
    }
    if (showUrl && url.trim()) {
      onSend({ url: url.trim() });
      setUrl("");
      setShowUrl(false);
      return;
    }
    const t = text.trim();
    if (!t) return;
    onSend({ text: t });
    setText("");
  }

  const canSend =
    !pending &&
    (Boolean(file) ||
      (showUrl && url.trim().length > 0) ||
      text.trim().length > 0);

  return (
    <div className="flex flex-col gap-2 border-t-2 border-line bg-paper px-4 pt-3">
      {file && (
        <div className="flex items-center gap-2 self-start border-2 border-line bg-paper-2 px-3 py-1.5">
          <ImageUp className="size-3.5 text-smoke" aria-hidden="true" />
          <span className="font-mono text-[0.6875rem] text-ink">
            {file.name}
          </span>
          <button
            type="button"
            onClick={() => setFile(null)}
            className="text-smoke hover:text-ink"
            aria-label="Remove photo"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {showUrl && (
        <input
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.instructables.com/…"
          className="w-full border-2 border-line bg-paper px-3 py-2 font-mono text-[0.8125rem] text-ink outline-none focus:border-signal"
        />
      )}

      <div className="flex items-end gap-2 pb-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          title="Attach a photo of a schematic, breadboard, or parts list"
          aria-label="Attach a photo"
          className="flex size-10 shrink-0 items-center justify-center border-2 border-line bg-paper text-smoke hover:text-ink"
        >
          <ImageUp className="size-4" aria-hidden="true" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => setShowUrl((s) => !s)}
          title="Paste a tutorial or build-log link"
          aria-label="Paste a link"
          aria-pressed={showUrl}
          className={`flex size-10 shrink-0 items-center justify-center border-2 border-line ${
            showUrl ? "bg-ink text-paper" : "bg-paper text-smoke hover:text-ink"
          }`}
        >
          <Link2 className="size-4" aria-hidden="true" />
        </button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Message the build assistant…"
          className="max-h-40 min-h-[2.5rem] flex-1 resize-none border-2 border-line bg-paper px-3 py-2 font-sans text-[0.9375rem] text-ink outline-none focus:border-signal"
        />
        <Button
          type="button"
          variant="primary"
          size="md"
          disabled={!canSend}
          onClick={submit}
        >
          <Send className="size-4" aria-hidden="true" />
          {pending ? "…" : "Send"}
        </Button>
      </div>
    </div>
  );
}
