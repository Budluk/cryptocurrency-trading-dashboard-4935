export interface ChatAttachment {
  name: string;
  content: string;
}

export const MAX_CHAT_FILES = 5;
export const MAX_CHAT_FILE_CHARS = 100_000;

const ALLOWED_EXT = new Set([
  'txt', 'md', 'markdown', 'ts', 'tsx', 'js', 'jsx', 'json', 'py', 'sql',
  'csv', 'log', 'yml', 'yaml', 'toml', 'pine', 'html', 'css', 'env',
]);

const extension = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

/** `File.text()` não existe no jsdom usado nos testes; FileReader cobre os dois. */
function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error(`Falha ao ler ${file.name}.`));
    reader.readAsText(file);
  });
}

/** Verdadeiro quando a mensagem deve usar o agente de pesquisa (sem ordens). */
export function isResearchMessage(text: string, files: ChatAttachment[] = []): boolean {
  return /https?:\/\//i.test(text) || files.length > 0;
}

/** Lê anexos de texto no navegador com limites antes de enviar ao servidor. */
export async function filesToAttachments(files: File[]): Promise<ChatAttachment[]> {
  if (files.length > MAX_CHAT_FILES) {
    throw new Error(`Máximo de ${MAX_CHAT_FILES} arquivos por mensagem.`);
  }
  const out: ChatAttachment[] = [];
  for (const file of files) {
    if (!ALLOWED_EXT.has(extension(file.name))) {
      throw new Error(`Tipo não suportado: ${file.name}. Use arquivos de texto/código.`);
    }
    if (file.size > MAX_CHAT_FILE_CHARS * 4) {
      throw new Error(`${file.name} é grande demais (máx. ${MAX_CHAT_FILE_CHARS} caracteres).`);
    }
    const content = (await readFileText(file)).slice(0, MAX_CHAT_FILE_CHARS);
    if (!content.trim()) throw new Error(`${file.name} está vazio.`);
    out.push({ name: file.name.split(/[\\/]/).pop() ?? file.name, content });
  }
  return out;
}
