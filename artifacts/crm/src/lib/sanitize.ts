export function sanitizeHtml(html: string): string {
  if (!html) return "";
  let s = String(html);
  s = s.replace(/<\s*(script|style|iframe|object|embed|link|meta|form)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  s = s.replace(/<\s*(script|style|iframe|object|embed|link|meta|form)\b[^>]*\/?>/gi, "");
  s = s.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "");
  s = s.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");
  s = s.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");
  s = s.replace(/(href|src|action|formaction|xlink:href)\s*=\s*"(?:javascript|data|vbscript):[^"]*"/gi, '$1="#"');
  s = s.replace(/(href|src|action|formaction|xlink:href)\s*=\s*'(?:javascript|data|vbscript):[^']*'/gi, "$1='#'");
  return s;
}
