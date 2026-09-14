import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { StudentRecord } from '../../shared/types';
import { CardDrawOverlay } from './CardDrawOverlay';

function studentWithStar(id: string, star: number): StudentRecord {
  return { id, name: `学生${id}`, weight: 1, drawnThisRound: false, star, drawCount: 0 };
}

describe('抽卡式动画', () => {
  it('卡片按星级挂载对应的卡面配色类', () => {
    const students = [studentWithStar('1', 1), studentWithStar('2', 3), studentWithStar('3', 5)];
    render(<CardDrawOverlay students={students} hitPity={false} onFinish={vi.fn()} />);

    for (let index = 0; index < students.length; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: `第 ${index + 1} 张卡，点击翻面` }));
    }

    expect(document.querySelector('.card-draw__face--star1')).not.toBeNull();
    expect(document.querySelector('.card-draw__face--star3')).not.toBeNull();
    expect(document.querySelector('.card-draw__face--star5')).not.toBeNull();
  });

  it('星级只显示星星图案，不显示「N 星」文字', () => {
    render(<CardDrawOverlay students={[studentWithStar('1', 4)]} hitPity={false} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '第 1 张卡，点击翻面' }));

    expect(document.querySelector('.card-draw__rank')).toBeNull();
    const stars = document.querySelectorAll('.card-draw__star');
    expect(stars).toHaveLength(4);
  });

  it('全部翻面后出现收下结果按钮，点击触发完成回调', () => {
    const onFinish = vi.fn();
    render(<CardDrawOverlay students={[studentWithStar('1', 2)]} hitPity={false} onFinish={onFinish} />);

    expect(screen.queryByRole('button', { name: '收下结果' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '第 1 张卡，点击翻面' }));
    fireEvent.click(screen.getByRole('button', { name: '收下结果' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
