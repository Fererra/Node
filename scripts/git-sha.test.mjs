import { describe, expect, it } from 'vitest';
import { setGitSha } from './git-sha.mjs';

const revParse = () => 'abc1234';
const failingRevParse = () => {
  throw new Error('not a git repository');
};

describe('setGitSha', () => {
  it('sets GIT_SHA from git when it is unset', () => {
    const env = {};
    setGitSha(env, revParse);
    expect(env).toEqual({ GIT_SHA: 'abc1234' });
  });

  it('sets GIT_SHA from git when it is empty', () => {
    const env = { GIT_SHA: '' };
    setGitSha(env, revParse);
    expect(env).toEqual({ GIT_SHA: 'abc1234' });
  });

  it('keeps an existing non-empty GIT_SHA', () => {
    const env = { GIT_SHA: 'preset1' };
    setGitSha(env, revParse);
    expect(env).toEqual({ GIT_SHA: 'preset1' });
  });

  it('leaves GIT_SHA unset when git fails', () => {
    const env = {};
    setGitSha(env, failingRevParse);
    expect(env).toEqual({});
  });
});
