import { describe, expect, it } from 'vitest';
import { getContext, runWithContext, setCurrentUser } from './context.js';
import { contextLogFields } from './logger.js';

describe('request context', () => {
  it('is undefined outside a request', () => {
    expect(getContext()).toBeUndefined();
    expect(contextLogFields()).toEqual({});
  });

  it('is visible across awaits and isolated between parallel runs', async () => {
    const seen = await Promise.all(
      ['a', 'b'].map((requestId) =>
        runWithContext({ requestId }, async () => {
          await new Promise((resolve) => setImmediate(resolve));
          return getContext()?.requestId;
        }),
      ),
    );
    expect(seen).toEqual(['a', 'b']);
  });

  it('adds userId to log fields once the user is set', () => {
    runWithContext({ requestId: 'r1' }, () => {
      expect(contextLogFields()).toEqual({ requestId: 'r1' });
      setCurrentUser({ id: 'u1', name: 'Alice' });
      expect(contextLogFields()).toEqual({ requestId: 'r1', userId: 'u1' });
    });
  });

  it('refuses to set a user outside a request', () => {
    expect(() => {
      setCurrentUser({ id: 'u1', name: 'Alice' });
    }).toThrow(/outside a request context/);
  });
});
