import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NamePickerApp } from './main';

describe('名字抽取器根组件', () => {
  it('渲染中文标题', () => {
    render(<NamePickerApp />);

    expect(screen.getByRole('heading', { name: '名字抽取器' })).toBeInTheDocument();
  });

  it('渲染空名单占位区域', () => {
    render(<NamePickerApp />);

    expect(screen.getByText('名单为空，请导入名单后开始抽取。')).toBeInTheDocument();
  });
});
