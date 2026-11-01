import { describe, expect, it } from 'vitest';
import { formatCaseCode, generateCaseCode } from '@whistledoor/crypto';
import { createFakeApi } from '../api/fake';
import { lastGroup, matchesLastGroup, openCase, postMessage, submitReport } from './case';

async function fixture() {
  const api = createFakeApi();
  const code = await generateCaseCode();
  const { tenantPk } = await api.tenant.get();
  return { api, code, tenantPk };
}

describe('case', () => {
  it('reads back a submitted report', async () => {
    const { api, code, tenantPk } = await fixture();
    await submitReport(api, code, { text: 'Hinweis' }, tenantPk);

    const opened = await openCase(api, code);

    expect(opened.status).toBe('new');
    expect(opened.issues).toEqual([]);
    expect(opened.messages.map((message) => message.text)).toEqual(['Hinweis']);
  });

  it('chains a reply to the report', async () => {
    const { api, code, tenantPk } = await fixture();
    await submitReport(api, code, { text: 'Hinweis' }, tenantPk);
    const { messages } = await openCase(api, code);

    await postMessage(api, code, 'Nachtrag', messages[0]!, false);
    const opened = await openCase(api, code);

    expect(opened.issues).toEqual([]);
    expect(opened.messages.map((message) => message.link.seq)).toEqual([0, 1]);
  });

  it('rejects a code with no case', async () => {
    const { api, code } = await fixture();
    await expect(openCase(api, code)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('never sends the code or the text', async () => {
    const { api, code, tenantPk } = await fixture();
    const sent: unknown[] = [];
    const submit = api.report.submit;
    api.report.submit = (input) => {
      sent.push(input);
      return submit(input);
    };

    await submitReport(api, code, { text: 'Geheimer Hinweis' }, tenantPk);

    const wire = JSON.stringify(sent);
    expect(wire).not.toContain('Geheimer');
    expect(wire).not.toContain(formatCaseCode(code).replaceAll('-', ''));
  });

  it('confirms the last group, ignoring case and spaces', async () => {
    const code = await generateCaseCode();
    expect(lastGroup(code)).toHaveLength(5);
    expect(matchesLastGroup(code, ` ${lastGroup(code).toLowerCase()} `)).toBe(true);
    expect(matchesLastGroup(code, '00000!')).toBe(false);
  });
});
