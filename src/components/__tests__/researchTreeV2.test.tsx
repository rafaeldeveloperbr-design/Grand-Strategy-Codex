// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResearchModal } from '../ResearchModal';
import { TECHNOLOGIES } from '../../data/technology';
import * as engine from '../../engine/technology';
import type { Country } from '../../types';
import type { CountryTechState } from '../../types/technology';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
const initial = () => engine.createInitialTechState('TST');
const root = TECHNOLOGIES.find(item => item.prerequisites.length === 0)!;
const child = TECHNOLOGIES.find(item => item.prerequisites.length > 0)!;
const node = (title = root.title) => screen.getByRole('button',{name:new RegExp(`^${title} —`)});
const details = (title = root.title) => screen.getByRole('dialog',{name:`Detalhes de ${title}`});
const setup = (techState: CountryTechState = initial(), gold = 100000) => {
  const props = {techState,playerCountry:{tag:'TST',resources:{gold}} as Country,onStartResearch:vi.fn(),onCancelResearch:vi.fn(),onClose:vi.fn()};
  return {...render(<ResearchModal {...props} />),...props};
};

describe('Research UI V2', () => {
  it('renders all four friendly categories', () => {
    setup();
    for (const category of ['Militar','Indústria','Economia','Sociedade']) expect(screen.getByRole('heading',{name:new RegExp(category)})).toBeTruthy();
  });
  it('renders 32 compact technologies without descriptions in nodes', () => {
    setup();
    expect(document.querySelectorAll('.research-node')).toHaveLength(32);
    for (const tech of TECHNOLOGIES) expect(node(tech.title).textContent).not.toContain(tech.description);
  });
  it('uses catalog column and row and derives canvas dimensions', () => {
    setup();
    for (const tech of TECHNOLOGIES) {
      expect(node(tech.title).style.gridColumn).toBe(String(tech.position.column+1));
      expect(node(tech.title).style.gridRow).toBe(String(tech.position.row+1));
    }
    const canvas = document.querySelector<HTMLElement>('.research-tree-canvas')!;
    expect(canvas.style.gridTemplateColumns).toContain(`repeat(${Math.max(...TECHNOLOGIES.map(t => t.position.column))+1},`);
    expect(canvas.style.gridTemplateRows).toContain(`repeat(${Math.max(...TECHNOLOGIES.map(t => t.position.row))+1},`);
  });
  it('marks completed technologies without start or cancel actions', () => {
    setup({...initial(),completedTechnologies:[root.id]});
    expect(node().classList.contains('research-node--completed')).toBe(true);
    fireEvent.click(node());
    expect(within(details()).getByText('Concluída')).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Iniciar pesquisa'})).toBeNull();
    expect(screen.queryByRole('button',{name:'Cancelar pesquisa'})).toBeNull();
  });
  it('shows canonical active progress in the node, summary and details', () => {
    const state = {...initial(),researchSlots: [{id:0,technologyId:root.id,progressDays:root.durationDays/2}]};
    setup(state);
    expect(node().classList.contains('research-node--active')).toBe(true);
    expect(within(node()).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50');
    expect(screen.getByText(`${root.title} — 50%`)).toBeTruthy();
    fireEvent.click(node());
    expect(within(details()).getByText(/Progresso:.*50%/).textContent).toContain(`~${engine.getResearchProgress(state)!.estimatedDaysRemaining} dias restantes`);
  });
  it('keeps blocked nodes inspectable without starting research', () => {
    const view = setup();
    fireEvent.click(node(child.title));
    expect(node(child.title).getAttribute('aria-disabled')).toBe('true');
    expect(node(child.title).classList.contains('research-node--blocked')).toBe(true);
    expect(screen.queryByRole('button',{name:'Iniciar pesquisa'})).toBeNull();
    expect(view.onStartResearch).not.toHaveBeenCalled();
  });
  it('shows description on hover', () => {
    setup(); fireEvent.mouseEnter(node());
    expect(within(details()).getByText(root.description)).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Iniciar pesquisa'})).toBeNull();
  });
  it('shows the gold cost', () => {
    setup(); fireEvent.click(node());
    expect(within(details()).getByText(`💰 ${root.costGold}`)).toBeTruthy();
    expect(within(details()).getByText('Custo')).toBeTruthy();
  });
  it('shows base duration', () => {
    setup(); fireEvent.click(node());
    expect(within(details()).getByText(`${root.durationDays} dias`)).toBeTruthy();
    expect(within(details()).getByText('Duração base')).toBeTruthy();
  });
  it('formats technology effects using the canonical formatter', () => {
    setup(); fireEvent.click(node());
    for (const effect of root.effects) expect(within(details()).getByText(engine.formatTechnologyEffect(effect))).toBeTruthy();
  });
  it('resolves prerequisites to friendly titles', () => {
    setup(); fireEvent.click(node(child.title));
    expect(within(details(child.title)).getByText(child.prerequisites.map(id => TECHNOLOGIES.find(t => t.id === id)!.title).join(', '))).toBeTruthy();
  });
  it('shows the canonical prerequisite block reason', () => {
    const view = setup(); fireEvent.click(node(child.title));
    expect(within(details(child.title)).getByText(engine.getTechnologyBlockReason(view.techState,child.id,view.playerCountry)!)).toBeTruthy();
  });
  it('shows insufficient gold as a canonical block', () => {
    const view = setup(initial(),0); fireEvent.click(node());
    expect(within(details()).getByText('Ouro insuficiente')).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Iniciar pesquisa'})).toBeNull();
    expect(view.onStartResearch).not.toHaveBeenCalled();
  });
  it('pins details on click without starting and ignores subsequent hover', () => {
    const view = setup(); fireEvent.click(node());
    fireEvent.mouseEnter(node(child.title)); fireEvent.mouseLeave(node());
    expect(details()).toBeTruthy();
    expect(screen.queryByRole('dialog',{name:`Detalhes de ${child.title}`})).toBeNull();
    expect(view.onStartResearch).not.toHaveBeenCalled();
  });
  it('starts only through the pinned action with the correct id', () => {
    const view = setup(); fireEvent.click(node());
    fireEvent.click(screen.getByRole('button',{name:'Iniciar pesquisa'}));
    expect(view.onStartResearch).toHaveBeenCalledExactlyOnceWith(root.id,0);
    expect(screen.queryByRole('dialog',{name:`Detalhes de ${root.title}`})).toBeNull();
  });
  it('cancels the active research through the pinned action', () => {
    const view = setup({...initial(),researchSlots: [{id:0,technologyId:root.id,progressDays:1}]});
    fireEvent.click(node()); fireEvent.click(screen.getByRole('button',{name:'Cancelar pesquisa'}));
    expect(view.onCancelResearch).toHaveBeenCalledOnce();
    expect(view.onStartResearch).not.toHaveBeenCalled();
  });
  it('never renders internal ids as visible text', () => {
    const view = setup();
    for (const tech of TECHNOLOGIES) {
      fireEvent.click(node(tech.title));
      for (const item of TECHNOLOGIES) expect(view.container.textContent).not.toContain(item.id);
    }
  });
  it('creates hidden, unfocusable connections for every prerequisite with semantic states', () => {
    const view = setup({...initial(),researchSlots: [{id:0,technologyId:child.id,progressDays:0}],completedTechnologies:child.prerequisites});
    expect(view.container.querySelectorAll('.research-connection')).toHaveLength(TECHNOLOGIES.reduce((sum,t) => sum+t.prerequisites.length,0));
    for (const tech of TECHNOLOGIES) for (const id of tech.prerequisites) expect(view.container.querySelector(`path[data-source="${id}"][data-target="${tech.id}"]`)).toBeTruthy();
    const svg = view.container.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(view.container.querySelector(`path[data-target="${child.id}"]`)?.classList.contains('research-connection--active')).toBe(true);
  });
  it('inspects on keyboard focus and moves focus to the pinned action', () => {
    setup(); const button = node();
    expect(button.tagName).toBe('BUTTON'); expect(button.tabIndex).toBe(0);
    act(() => button.focus()); expect(details()).toBeTruthy();
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-controls')).toBe(details().id);
    // Native Enter/Space activate buttons; jsdom requires the resulting click.
    fireEvent.click(button);
    expect(document.activeElement).toBe(screen.getByRole('button',{name:'Iniciar pesquisa'}));
  });
  it('dismisses details on Escape, restores the node, then closes on a second Escape', () => {
    const view = setup(); const button = node(); fireEvent.click(button);
    fireEvent.keyDown(document.activeElement!,{key:'Escape'});
    expect(screen.queryByRole('dialog',{name:`Detalhes de ${root.title}`})).toBeNull();
    expect(document.activeElement).toBe(button); expect(view.onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(button,{key:'Escape'}); expect(view.onClose).toHaveBeenCalledOnce();
  });
  it('preserves active modifier entries', () => {
    const state = {...initial(),completedTechnologies:[root.id]}; setup(state);
    const section = screen.getByRole('region',{name:'Modificadores tecnológicos ativos'});
    for (const entry of engine.getActiveTechnologyModifierEntries(state)) expect(section.textContent).toContain(`${entry.label}: ${entry.percent > 0 ? '+' : ''}${entry.percent}%`);
  });
  it('uses canonical validation instead of duplicating availability rules', () => {
    const original = engine.getTechnologyBlockReason;
    const spy = vi.spyOn(engine,'getTechnologyBlockReason').mockImplementation((state,id,country) => id === root.id ? 'Bloqueio canônico de teste' : original(state,id,country));
    const view = setup(); fireEvent.click(node());
    expect(node().getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('Bloqueio canônico de teste')).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Iniciar pesquisa'})).toBeNull();
    expect(spy).toHaveBeenCalledWith(view.techState,root.id,view.playerCountry);
  });
  it('revalidates immediately when gold or active research changes', () => {
    const view = setup(); fireEvent.click(node());
    view.rerender(<ResearchModal {...view} playerCountry={{...view.playerCountry,resources:{...view.playerCountry.resources,gold:0}}} />);
    expect(screen.queryByRole('button',{name:'Iniciar pesquisa'})).toBeNull();
    expect(screen.getByText('Ouro insuficiente')).toBeTruthy();
    view.rerender(<ResearchModal {...view} techState={{...initial(),researchSlots: [{id:0,technologyId:child.id,progressDays:0}]}} />);
    expect(screen.getByText('Nenhum slot de pesquisa livre')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button',{name:'Voltar à árvore'}));
  });
  it('revalidates again at action time', () => {
    const original = engine.getTechnologyBlockReason;
    const spy = vi.spyOn(engine,'getTechnologyBlockReason').mockImplementation(original);
    const view = setup(); fireEvent.click(node());
    spy.mockReturnValue('Ouro insuficiente');
    fireEvent.click(screen.getByRole('button',{name:'Iniciar pesquisa'}));
    expect(view.onStartResearch).not.toHaveBeenCalled();
  });
  it('traps Tab and restores the opener on unmount', () => {
    const opener = document.createElement('button'); document.body.append(opener); opener.focus();
    const view = setup(); const close = screen.getByRole('button',{name:'Fechar pesquisa tecnológica'});
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close,{key:'Tab',shiftKey:true});
    expect(document.activeElement).toBe(node(TECHNOLOGIES[TECHNOLOGIES.length-1].title));
    act(() => within(details(TECHNOLOGIES[TECHNOLOGIES.length-1].title)).getByRole('button',{name:'Fechar detalhes'}).focus());
    fireEvent.keyDown(document.activeElement!,{key:'Tab'}); expect(document.activeElement).toBe(close);
    view.unmount(); expect(document.activeElement).toBe(opener); opener.remove();
  });
  it('keeps hover open while entering details and dismisses after leaving', () => {
    vi.useFakeTimers(); setup(); fireEvent.mouseEnter(node()); fireEvent.mouseLeave(node());
    fireEvent.mouseEnter(details()); act(() => vi.advanceTimersByTime(200)); expect(details()).toBeTruthy();
    fireEvent.mouseLeave(details()); act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByRole('dialog',{name:`Detalhes de ${root.title}`})).toBeNull();
  });
  it('dismisses pinned details on scroll and retains focused inspection', () => {
    setup(); fireEvent.click(node()); fireEvent.scroll(screen.getByRole('region',{name:'Árvore tecnológica'}));
    expect(screen.queryByRole('dialog',{name:`Detalhes de ${root.title}`})).toBeNull();
    act(() => node(child.title).focus()); fireEvent.scroll(screen.getByRole('region',{name:'Árvore tecnológica'}));
    expect(details(child.title)).toBeTruthy();
  });
  it('closes with the labeled button and backdrop', () => {
    const view = setup(); fireEvent.click(screen.getByRole('button',{name:'Fechar pesquisa tecnológica'}));
    fireEvent.click(view.container.querySelector('.tech-modal__overlay')!); expect(view.onClose).toHaveBeenCalledTimes(2);
  });
});
