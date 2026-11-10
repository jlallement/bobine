/** Texte venu du main process, `code` entre accents graves (détails des agents, astuces). */
export function CodeText({ text }: { text: string }) {
  return <>{text.split('`').map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part))}</>
}
