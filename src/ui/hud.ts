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
  private gameover = document.getElementById('hud-gameover')!;
  private buttons = new Map<string, HTMLButtonElement>();

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

  setInfo(html: string): void {
    this.info.innerHTML = html;
    this.info.style.display = html ? 'block' : 'none';
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
