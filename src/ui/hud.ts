// DOM overlay HUD. Buttons and counters are miserable in Pixi and free in DOM.

export interface BuildMenuItem {
  id: string;
  label: string;
  hint?: string;
}

export class Hud {
  private top = document.getElementById('hud-top')!;
  private build = document.getElementById('hud-build')!;
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

  setActiveButton(id: string | null): void {
    for (const [key, btn] of this.buttons) {
      btn.classList.toggle('active', key === id);
    }
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
