"use client";

export function PrintButton({ filename }: { filename?: string }) {
  // Safari and Chrome name the saved PDF after the document title; it is restored afterwards.
  const go = () => {
    const before = document.title;
    if (filename) document.title = filename;
    const restore = () => { document.title = before; window.removeEventListener("afterprint", restore); };
    window.addEventListener("afterprint", restore);
    window.print();
    setTimeout(restore, 5000);
  };
  return (
    <button type="button" onClick={go} className="border border-ink bg-ink px-5 py-2 text-lg text-paper">
      Print, or save as PDF
    </button>
  );
}
