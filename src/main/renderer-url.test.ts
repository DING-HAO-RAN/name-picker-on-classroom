import { describe, expect, it } from 'vitest';
import { getDevelopmentRendererUrl } from './renderer-url';

describe('开发 renderer URL 安全判断', () => {
  it.each(['http://localhost:5173', 'http://127.0.0.1:5173', 'http://[::1]:5173'])(
    '开发模式允许本机 HTTP URL：%s',
    (rendererUrl) => {
      expect(getDevelopmentRendererUrl(false, rendererUrl)).toBe(rendererUrl);
    },
  );

  it('拒绝外部或非 HTTP URL', () => {
    expect(getDevelopmentRendererUrl(false, 'https://example.com')).toBeUndefined();
    expect(getDevelopmentRendererUrl(false, 'http://example.com')).toBeUndefined();
    expect(getDevelopmentRendererUrl(false, 'https://localhost:5173')).toBeUndefined();
    expect(getDevelopmentRendererUrl(false, 'not-a-url')).toBeUndefined();
  });

  it('打包模式拒绝开发 URL 并回退本地页面', () => {
    expect(getDevelopmentRendererUrl(true, 'http://localhost:5173')).toBeUndefined();
  });
});
