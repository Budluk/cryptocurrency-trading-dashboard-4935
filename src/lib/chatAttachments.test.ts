import { describe, expect, test } from 'vitest';
import { filesToAttachments, isResearchMessage } from './chatAttachments';

describe('chatAttachments', () => {
  test('detecta links e anexos como modo pesquisa', () => {
    expect(isResearchMessage('Analise o saldo')).toBe(false);
    expect(isResearchMessage('Leia https://github.com/Budluk/projeto')).toBe(true);
    expect(isResearchMessage('', [{ name: 'a.md', content: 'x' }])).toBe(true);
  });

  test('lê arquivos de texto aceitos', async () => {
    const files = [
      new File(['# Estratégia\ncomprar em pullback'], 'estrategia.md', { type: 'text/markdown' }),
      new File(['SELECT * FROM ai_decisions'], 'consulta.sql', { type: 'text/plain' }),
    ];
    const out = await filesToAttachments(files);
    expect(out.map((a) => a.name)).toEqual(['estrategia.md', 'consulta.sql']);
    expect(out[0].content).toContain('Estratégia');
  });

  test('rejeita tipo binário', async () => {
    const files = [new File(['_binary_'], 'grafico.png', { type: 'image/png' })];
    await expect(filesToAttachments(files)).rejects.toThrow('Tipo não suportado');
  });

  test('rejeita mais de cinco arquivos', async () => {
    const files = Array.from({ length: 6 }, (_, i) => new File(['x'], `a${i}.txt`));
    await expect(filesToAttachments(files)).rejects.toThrow('Máximo de 5 arquivos');
  });
});
