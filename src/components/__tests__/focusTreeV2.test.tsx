// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { FocusModal } from '../FocusModal';
import { NATIONAL_FOCUSES } from '../../data/technology';
import { createInitialTechState, getFocusBlockReason } from '../../engine/technology';

afterEach(cleanup);
it('exposes all six categories and every focus in the existing modal', () => {
  render(<FocusModal techState={createInitialTechState('TST')} onStartFocus={vi.fn()} onCancelFocus={vi.fn()} onClose={vi.fn()} />);
  for (const category of ['MILITAR','ECONOMIA','POLÍTICA','INDÚSTRIA','DIPLOMACIA','PESQUISA']) expect(screen.getByRole('heading',{name:new RegExp(category)})).toBeTruthy();
  for (const focus of NATIONAL_FOCUSES) expect(screen.getByRole('heading',{name:focus.title,level:4})).toBeTruthy();
});
it('uses canonical locks for exclusivity and keeps the active cancel action', () => {
  const onCancelFocus = vi.fn();
  const onStartFocus = vi.fn();
  const state = {...createInitialTechState('TST'),completedFocuses:['focus_regional_diplomacy','focus_alliance_policy']};
  const view = render(<FocusModal techState={state} onStartFocus={onStartFocus} onCancelFocus={onCancelFocus} onClose={vi.fn()} />);
  const blockedCard = screen.getByRole('heading',{name:'Projeção Regional'}).parentElement!;
  const blocked = within(blockedCard).getByRole('button');
  expect(blocked.hasAttribute('disabled')).toBe(true);
  expect(blocked.title).toBe(getFocusBlockReason(state,'focus_regional_projection'));
  fireEvent.click(blocked);
  expect(onStartFocus).not.toHaveBeenCalled();
  const available = within(screen.getByRole('heading',{name:'Unidade Nacional'}).parentElement!).getByRole('button');
  fireEvent.click(available);
  expect(onStartFocus).toHaveBeenCalledWith('focus_national_unity');
  view.rerender(<FocusModal techState={{...state,activeFocusId:'focus_national_unity',focusProgressDays:10}} onStartFocus={onStartFocus} onCancelFocus={onCancelFocus} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button',{name:'✕ Cancelar'}));
  expect(onCancelFocus).toHaveBeenCalledOnce();
});
