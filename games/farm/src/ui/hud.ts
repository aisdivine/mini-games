// DOM HUD for the farm: top stats, tool belt, action buttons, shop panel, and
// transient toasts. Pure view + event wiring — main.ts owns the callbacks.

import { CROPS, CROP_ORDER, MAX_ENERGY, hearts, type CropType, type Tool } from '../config';
import type { World } from '../sim/world';

type ToolCb = (tool: Tool) => void;
type SeedCb = (crop: CropType) => void;
type ActionCb = (id: 'shop' | 'gift' | 'sleep' | 'save') => void;
type ShopCb = (kind: 'buy' | 'sell', crop: CropType) => void;

const $ = (id: string): HTMLElement => document.getElementById(id)!;

export class Hud {
  private top = $('hud-top');
  private tools = $('hud-tools');
  private actions = $('hud-actions');
  private shop = $('hud-shop');
  private messages = $('hud-messages');
  private toolCb: ToolCb = () => {};
  private seedCb: SeedCb = () => {};
  private actionCb: ActionCb = () => {};
  private shopCb: ShopCb = () => {};
  private shopOpen = false;

  constructor() {
    this.tools.innerHTML = `
      <button class="tool" data-tool="hoe" title="Hoe — till grass into soil">⛏️<span>Hoe</span></button>
      <button class="tool" data-tool="water" title="Watering can — water planted crops">💧<span>Water</span></button>
      <button class="tool" data-tool="plant" title="Plant the selected seed on tilled soil">🌱<span>Plant</span></button>
      <button class="seed" data-seed title="Click to change which seed you plant"></button>`;
    this.actions.innerHTML = `
      <button data-act="shop">🛒 Shop</button>
      <button data-act="gift">🎁 Gift Farmhand</button>
      <button data-act="sleep">💤 Sleep</button>
      <button data-act="save">💾 Save</button>`;

    this.tools.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('[data-tool]') as HTMLElement | null;
      if (t) this.toolCb(t.dataset.tool as Tool);
      const s = (e.target as HTMLElement).closest('[data-seed]');
      if (s) this.seedCb(this.nextSeed());
    });
    this.actions.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
      if (!b) return;
      const id = b.dataset.act as 'shop' | 'gift' | 'sleep' | 'save';
      if (id === 'shop') {
        this.shopOpen = !this.shopOpen;
        this.shop.classList.toggle('open', this.shopOpen);
      }
      this.actionCb(id);
    });
    this.shop.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-buy],[data-sell]') as HTMLElement | null;
      if (!b) return;
      if (b.dataset.buy) this.shopCb('buy', b.dataset.buy as CropType);
      else this.shopCb('sell', b.dataset.sell as CropType);
    });
  }

  onTool(cb: ToolCb): void {
    this.toolCb = cb;
  }
  onSelectSeed(cb: SeedCb): void {
    this.seedCb = cb;
  }
  onAction(cb: ActionCb): void {
    this.actionCb = cb;
  }
  onShop(cb: ShopCb): void {
    this.shopCb = cb;
  }

  private currentSeed: CropType = 'parsnip';
  private nextSeed(): CropType {
    const i = CROP_ORDER.indexOf(this.currentSeed);
    return CROP_ORDER[(i + 1) % CROP_ORDER.length];
  }

  /** Reflect the live world + the selected tool/seed into the DOM. */
  render(world: World, tool: Tool, seed: CropType): void {
    this.currentSeed = seed;
    const eb = Math.round((world.energy / MAX_ENERGY) * 100);
    const hp = hearts(world.helperMood);
    const heartStr = '❤️'.repeat(hp) + '🤍'.repeat(Math.max(0, 10 - hp));
    this.top.innerHTML = `
      <span class="stat">🗓️ Day ${world.day}</span>
      <span class="stat">💰 ${world.gold}g</span>
      <span class="stat energy"><span class="bar"><span style="width:${eb}%"></span></span> ⚡${world.energy}</span>
      <span class="stat helper" title="Farmhand's mood — gift them crops. They water more for you as it grows.">💖 ${heartStr}</span>`;

    for (const btn of Array.from(this.tools.querySelectorAll('[data-tool]')) as HTMLElement[]) {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    }
    const seedBtn = this.tools.querySelector('[data-seed]') as HTMLElement;
    const d = CROPS[seed];
    seedBtn.innerHTML = `${d.emoji}<span>${d.label} ×${world.seeds[seed]}</span>`;
    seedBtn.classList.toggle('active', tool === 'plant');

    if (this.shopOpen) this.renderShop(world);
  }

  private renderShop(world: World): void {
    const rows = CROP_ORDER.map((c) => {
      const d = CROPS[c];
      const have = world.harvest[c];
      return `<div class="shop-row">
        <span class="name">${d.emoji} ${d.label}</span>
        <button data-buy="${c}" ${world.gold < d.seedCost ? 'disabled' : ''}>Buy seed ${d.seedCost}g</button>
        <button data-sell="${c}" ${have <= 0 ? 'disabled' : ''}>Sell ${have} (+${d.sell}g)</button>
      </div>`;
    }).join('');
    const grow = CROP_ORDER.map((c) => `${CROPS[c].emoji}${CROPS[c].days}d`).join(' · ');
    this.shop.innerHTML = `<h3>🛒 Market</h3>${rows}
      <div class="shop-note">Plant on tilled soil, water daily — ready in: ${grow}</div>`;
  }

  toast(msg: string): void {
    if (!msg) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    this.messages.appendChild(el);
    setTimeout(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 2600);
  }
}
