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

  it('星级只显示星星图案，不显示「N 星」文字；背面只显示颜色不透露名字与星星', () => {
    const students = [studentWithStar('1', 4)];
    render(<CardDrawOverlay students={students} hitPity={false} onFinish={vi.fn()} />);
    // 卡背内没有名字与星星（正面在 DOM 中存在但被 3D 遮挡，视觉不可见）
    expect(document.querySelector('.card-draw__face--back .card-draw__name')).toBeNull();
    expect(document.querySelectorAll('.card-draw__face--back .card-draw__star')).toHaveLength(0);
    // 卡背挂载 4 星配色类（翻面前即可看到正确颜色）
    expect(document.querySelectorAll('.card-draw__face--back.card-draw__face--star4')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: '第 1 张卡，点击翻面' }));

    expect(document.querySelector('.card-draw__rank')).toBeNull();
    // 翻开后正面显示星星：4 颗
    expect(document.querySelectorAll('.card-draw__face--front .card-draw__star')).toHaveLength(4);
    // 正反两面都挂载 4 星配色类
    expect(document.querySelectorAll('.card-draw__face--star4')).toHaveLength(2);
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
