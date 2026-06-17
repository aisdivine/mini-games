// DOM overlay HUD. Buttons and counters are miserable in Pixi and free in DOM.

export interface BuildMenuItem {
  id: string;
  label: string;
  hint?: string;
}

export interface MarketRow {
  id: string;
  label: string; // HTML (icon + name)
  sell: number;
  buy: number;
}

export interface TrainRow {
  id: string;
  label: string; // unit name
  cost: string; // formatted cost text
}

export class Hud {
  private top = document.getElementById('hud-top')!;
  private controls = document.getElementById('hud-controls')!;
  private build = document.getElementById('hud-build')!;
  private market = document.getElementById('hud-market')!;
  private marketTitle = document.createElement('div');
  private marketRows = new Map<
    string,
    { count: HTMLElement; sell: HTMLButtonElement; buy: HTMLButtonElement }
  >();
  private barracks = document.getElementById('hud-barracks')!;
  private barracksRows = new Map<string, HTMLButtonElement>();
  private debug = document.getElementById('hud-debug')!;
  private messages = document.getElementById('hud-messages')!;
  private info = document.getElementById('hud-info')!;
  private tooltip = document.getElementById('hud-tooltip')!;
  private gameover = document.getElementById('hud-gameover')!;
  private buttons = new Map<string, HTMLButtonElement>();

  // The info panel is split into volatile text (re-rendered every frame) and a
  // PERSISTENT action button. The button must never be recreated, or a real
  // click (down on one frame, up on the next) gets dropped mid-render.
  private infoText = document.createElement('div');
  private infoBtn = document.createElement('button');

  constructor() {
    this.info.innerHTML = '';
    this.infoBtn.style.display = 'none';
    this.info.append(this.infoText, this.infoBtn);
  }

  setTopBar(html: string): void {
    this.top.innerHTML = html;
  }

  buildMenu(items: BuildMenuItem[], onSelect: (id: string) => void): void {
    this.build.innerHTML = '';
    this.buttons.clear();
    for (const item of items) {
      const btn = document.createElement('button');
      btn.textContent = item.label;
      if (item.hint) btn.title = item.hint;
      btn.addEventListener('click', () => onSelect(item.id));
      this.build.appendChild(btn);
      this.buttons.set(item.id, btn);
    }
  }

  /** Always-visible control cluster (pause / speed) — registers into the same
   *  button map so setButtonLabel works for these too. */
  controlMenu(items: BuildMenuItem[], onSelect: (id: string) => void): void {
    for (const item of items) {
      const btn = document.createElement('button');
      btn.textContent = item.label;
      if (item.hint) btn.title = item.hint;
      btn.addEventListener('click', () => onSelect(item.id));
      this.controls.appendChild(btn);
      this.buttons.set(item.id, btn);
    }
  }

  /** Build the market trade panel once (persistent buttons survive per-frame
   *  state updates, so real clicks aren't dropped). */
  buildMarket(rows: MarketRow[], onTrade: (id: string, dir: 'buy' | 'sell') => void): void {
    this.market.innerHTML = '';
    this.marketRows.clear();
    this.marketTitle.className = 'm-title';
    this.market.appendChild(this.marketTitle);
    for (const r of rows) {
      const row = document.createElement('div');
      row.className = 'm-row';
      const lbl = document.createElement('span');
      lbl.className = 'm-lbl';
      lbl.innerHTML = r.label;
      const count = document.createElement('span');
      count.className = 'm-count';
      const sell = document.createElement('button');
      sell.textContent = `Sell +${r.sell}`;
      sell.title = `Sell 1 for ${r.sell} gold`;
      sell.addEventListener('click', () => onTrade(r.id, 'sell'));
      const buy = document.createElement('button');
      buy.textContent = `Buy −${r.buy}`;
      buy.title = `Buy 1 for ${r.buy} gold`;
      buy.addEventListener('click', () => onTrade(r.id, 'buy'));
      row.append(lbl, count, sell, buy);
      this.market.appendChild(row);
      this.marketRows.set(r.id, { count, sell, buy });
    }
  }

  showMarket(show: boolean): void {
    this.market.style.display = show ? 'block' : 'none';
  }

  /** Per-frame: refresh gold, on-hand counts, and affordability (button state). */
  updateMarket(
    gold: number,
    counts: Record<string, number>,
    canBuy: Record<string, boolean>,
  ): void {
    this.marketTitle.innerHTML = `<span class="m-gold">🪙 ${gold}</span> Market`;
    for (const [id, row] of this.marketRows) {
      const n = counts[id] ?? 0;
      if (row.count.textContent !== String(n)) row.count.textContent = String(n);
      row.sell.disabled = n < 1;
      row.buy.disabled = !canBuy[id];
    }
  }

  /** Build the barracks training panel once (one Train button per soldier). */
  buildBarracks(rows: TrainRow[], onTrain: (id: string) => void): void {
    this.barracks.innerHTML = '';
    this.barracksRows.clear();
    const title = document.createElement('div');
    title.className = 'm-title';
    title.textContent = '⚔ Barracks';
    this.barracks.appendChild(title);
    for (const r of rows) {
      const row = document.createElement('div');
      row.className = 'm-row';
      const lbl = document.createElement('span');
      lbl.className = 'm-lbl';
      lbl.textContent = r.label;
      const cost = document.createElement('span');
      cost.className = 'b-cost';
      cost.textContent = r.cost;
      const train = document.createElement('button');
      train.textContent = 'Train';
      train.addEventListener('click', () => onTrain(r.id));
      row.append(lbl, cost, train);
      this.barracks.appendChild(row);
      this.barracksRows.set(r.id, train);
    }
  }

  showBarracks(show: boolean): void {
    this.barracks.style.display = show ? 'block' : 'none';
  }

  updateBarracks(canTrain: Record<string, boolean>): void {
    for (const [id, btn] of this.barracksRows) btn.disabled = !canTrain[id];
  }

  setActiveButton(id: string | null): void {
    for (const [key, btn] of this.buttons) {
      btn.classList.toggle('active', key === id);
    }
  }

  /** Update a build-menu button's label (and optional tooltip) in place. */
  setButtonLabel(id: string, label: string, title?: string): void {
    const btn = this.buttons.get(id);
    if (!btn) return;
    if (btn.textContent !== label) btn.textContent = label;
    if (title !== undefined && btn.title !== title) btn.title = title;
  }

  /** Volatile status text (safe to call every frame). */
  setInfo(html: string): void {
    this.info.style.display = html ? 'block' : 'none';
    if (this.infoText.innerHTML !== html) this.infoText.innerHTML = html;
  }

  /** Update the persistent action button (never recreated). label=null hides it. */
  setAction(label: string | null, enabled = true): void {
    if (!label) {
      this.infoBtn.style.display = 'none';
      return;
    }
    this.infoBtn.style.display = 'block';
    if (this.infoBtn.textContent !== label) this.infoBtn.textContent = label;
    this.infoBtn.disabled = !enabled;
  }

  /** Click handler for the persistent info-panel action button. */
  onInfoAction(cb: () => void): void {
    this.infoBtn.addEventListener('click', cb);
  }

  /** Cursor-following hover tooltip. */
  showTooltip(html: string, x: number, y: number): void {
    this.tooltip.innerHTML = html;
    this.tooltip.style.display = 'block';
    // keep it on-screen: flip left/up near the right/bottom edges
    const w = this.tooltip.offsetWidth;
    const h = this.tooltip.offsetHeight;
    const px = x + 16 + w > window.innerWidth ? x - 16 - w : x + 16;
    const py = y + 16 + h > window.innerHeight ? y - 16 - h : y + 16;
    this.tooltip.style.left = `${px}px`;
    this.tooltip.style.top = `${py}px`;
  }

  hideTooltip(): void {
    this.tooltip.style.display = 'none';
  }

  setDebug(text: string): void {
    this.debug.textContent = text;
  }

  showMessage(text: string, ms = 4000): void {
    const el = document.createElement('div');
    el.className = 'hud-message';
    el.textContent = text;
    this.messages.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  showGameOver(outcome: 'won' | 'lost', reason: string, onNewGame: () => void): void {
    this.gameover.innerHTML = `
      <div class="gameover-box">
        <h1>${outcome === 'won' ? '🏆 Victory!' : '💀 Defeat'}</h1>
        <p>${reason}</p>
        <button id="newgame-btn">New Game</button>
      </div>`;
    this.gameover.style.display = 'flex';
    document.getElementById('newgame-btn')!.addEventListener('click', onNewGame);
  }
}
